package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	workspaces = "cujarrett/homelab-workspaces"
	githubAPI  = "https://api.github.com"
	raw        = "https://raw.githubusercontent.com"
	userAgent  = "platform-graph-demo-backend"
)

var (
	subgraphs = []string{"records", "reviews"}
	lanes     = []string{"test", "prod"}
)

// query is one of the fixed queries. The public picks one by name and never sends GraphQL.
// touches names the subgraphs the plan will hit. The router's own plan replaces it when the response carries one.
type query struct {
	Name    string   `json:"name"`
	Title   string   `json:"title"`
	Query   string   `json:"query"`
	touches []string
}

var queries = []query{
	{Name: "records", Title: "One subgraph", Query: "{ records { title artist } }", touches: []string{"records"}},
	{Name: "federated", Title: "Both subgraphs, one query", Query: "{ records { title artist reviews { rating body } } }", touches: []string{"records", "reviews"}},
}

// Every click reaches the router while the budget lasts. Past 30 calls a minute per query the last answer is served.
// GitHub's unauthenticated API allows 60 calls an hour, so the repos are read every ten minutes.
const githubTTL = 10 * time.Minute

type server struct {
	routerURL string
	client    *http.Client
	budget    *Budget
	cache     Cache
	mu        sync.Mutex
	last      map[string]answer
}

type plan struct {
	Text      string   `json:"text"`
	Subgraphs []string `json:"subgraphs"`
}

type answer struct {
	Name   string          `json:"name"`
	Title  string          `json:"title"`
	Query  string          `json:"query"`
	Status int             `json:"status"`
	Ms     int64           `json:"ms"`
	Data   json.RawMessage `json:"data"`
	Errors json.RawMessage `json:"errors"`
	Plan   plan            `json:"plan"`
	RanAt  string          `json:"ranAt"`
	Cached bool            `json:"cached,omitempty"`
}

func main() {
	port := envOr("PORT", "8080")
	metricsPort := envOr("METRICS_PORT", "9090")
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	s := &server{
		// The prod router, reached through the mesh. The Api file declares it in consumes.
		routerURL: envOr("ROUTER_URL", "http://storefront-router.graph-prod.svc.cluster.local/"),
		client:    &http.Client{Timeout: 8 * time.Second},
		budget:    NewBudget(30, time.Minute),
		last:      map[string]answer{},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok")) //nolint:errcheck
	})
	mux.HandleFunc("GET /v1/queries", s.listQueries)
	mux.HandleFunc("GET /v1/queries/{name}", s.runNamed)
	mux.HandleFunc("GET /v1/lane", s.lane)
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	})
	srv := &http.Server{Addr: ":" + port, Handler: mux}

	// Metrics on their own port. The platform scrapes it without mTLS,
	// so it must never share a port with the API.
	metricsMux := http.NewServeMux()
	metricsMux.Handle("GET /metrics", promhttp.Handler())
	metrics := &http.Server{Addr: ":" + metricsPort, Handler: metricsMux}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	for _, hs := range []*http.Server{srv, metrics} {
		go func() {
			if err := hs.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				logger.Error("server error", "addr", hs.Addr, "err", err)
				os.Exit(1)
			}
		}()
	}
	logger.Info("graph demo backend listening", "port", port)

	<-ctx.Done()
	logger.Info("shutting down")
	for _, hs := range []*http.Server{srv, metrics} {
		if err := hs.Shutdown(context.Background()); err != nil {
			logger.Error("shutdown error", "addr", hs.Addr, "err", err)
		}
	}
}

func (s *server) listQueries(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, queries)
}

func (s *server) runNamed(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	var q *query
	for i := range queries {
		if queries[i].Name == name {
			q = &queries[i]
		}
	}
	if q == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no such query"})
		return
	}
	s.mu.Lock()
	last, hasLast := s.last[name]
	s.mu.Unlock()
	if hasLast && !s.budget.Take(name, time.Now()) {
		last.Cached = true
		writeJSON(w, http.StatusOK, last)
		return
	}
	a, err := s.runQuery(r.Context(), *q)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	s.mu.Lock()
	s.last[name] = a
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, a)
}

func (s *server) runQuery(ctx context.Context, q query) (answer, error) {
	body, _ := json.Marshal(map[string]string{"query": q.Query})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.routerURL, bytes.NewReader(body))
	if err != nil {
		return answer{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	// Router config turns the plugin on. The header asks for it per request.
	req.Header.Set("Apollo-Expose-Query-Plan", "true")
	started := time.Now()
	res, err := s.client.Do(req)
	if err != nil {
		return answer{}, err
	}
	defer res.Body.Close() //nolint:errcheck
	ms := time.Since(started).Milliseconds()

	var out struct {
		Data       json.RawMessage `json:"data"`
		Errors     json.RawMessage `json:"errors"`
		Extensions struct {
			ApolloQueryPlan *struct {
				Text   string          `json:"text"`
				Object json.RawMessage `json:"object"`
			} `json:"apolloQueryPlan"`
		} `json:"extensions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return answer{}, fmt.Errorf("router answered %d: %w", res.StatusCode, err)
	}
	p := plan{Text: "", Subgraphs: q.touches}
	if qp := out.Extensions.ApolloQueryPlan; qp != nil {
		p = plan{Text: qp.Text, Subgraphs: subgraphsOf(qp.Object)}
	}
	return answer{
		Name: q.Name, Title: q.Title, Query: q.Query,
		Status: res.StatusCode, Ms: ms,
		Data: out.Data, Errors: out.Errors, Plan: p,
		RanAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
	}, nil
}

// The load ignores the request context, so one caller leaving does not fail everyone waiting on it.
func (s *server) lane(w http.ResponseWriter, _ *http.Request) {
	v, err := s.cache.Get("lane", githubTTL, func() (any, error) { return s.loadLane(context.Background()) })
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, v)
}

type schemaCommit struct {
	SHA     string `json:"sha"`
	URL     string `json:"url"`
	Date    string `json:"date"`
	Message string `json:"message"`
}

type laneFile struct {
	Image *string `json:"image"`
	File  string  `json:"file"`
	URL   string  `json:"url"`
}

type subgraphLane struct {
	SchemaCommit *schemaCommit       `json:"schemaCommit"`
	Lanes        map[string]laneFile `json:"lanes"`
}

// loadLane reads what the page shows live.
// It covers each subgraph's last schema commit in its own repo, and the digest each lane runs.
func (s *server) loadLane(ctx context.Context) (any, error) {
	out := map[string]subgraphLane{}
	for _, sg := range subgraphs {
		var commits []struct {
			SHA     string `json:"sha"`
			HTMLURL string `json:"html_url"`
			Commit  struct {
				Message   string `json:"message"`
				Committer struct {
					Date string `json:"date"`
				} `json:"committer"`
			} `json:"commit"`
		}
		url := fmt.Sprintf("%s/repos/cujarrett/storefront-%s/commits?path=schema.graphql&per_page=1", githubAPI, sg)
		b, err := s.get(ctx, url, "application/json")
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(b, &commits); err != nil {
			return nil, fmt.Errorf("%s: %w", url, err)
		}
		entry := subgraphLane{Lanes: map[string]laneFile{}}
		if len(commits) > 0 {
			c := commits[0]
			entry.SchemaCommit = &schemaCommit{
				SHA: c.SHA, URL: c.HTMLURL, Date: c.Commit.Committer.Date,
				Message: strings.SplitN(c.Commit.Message, "\n", 2)[0],
			}
		}
		for _, lane := range lanes {
			file := fmt.Sprintf("graph-%s/%s.yaml", lane, sg)
			yaml, err := s.get(ctx, fmt.Sprintf("%s/%s/main/%s", raw, workspaces, file), "")
			if err != nil {
				return nil, err
			}
			lf := laneFile{File: file, URL: fmt.Sprintf("https://github.com/%s/blob/main/%s", workspaces, file)}
			if img := imageOf(string(yaml)); img != "" {
				lf.Image = &img
			}
			entry.Lanes[lane] = lf
		}
		out[sg] = entry
	}
	return map[string]any{
		"subgraphs": out,
		"graph":     "storefront-homelab",
		"fetchedAt": time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
	}, nil
}

func (s *server) get(ctx context.Context, url, accept string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	if accept != "" {
		req.Header.Set("Accept", accept)
	}
	res, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close() //nolint:errcheck
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s answered %d", url, res.StatusCode)
	}
	return io.ReadAll(res.Body)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
