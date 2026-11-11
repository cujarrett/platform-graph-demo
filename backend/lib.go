package main

import (
	"bytes"
	"encoding/json"
	"regexp"
	"sync"
	"time"
)

// subgraphsOf lists every subgraph a query plan fetched from, in plan order, without repeats.
// It reads the JSON as a token stream, because a decoded map would lose the plan's order.
func subgraphsOf(plan json.RawMessage) []string {
	found := []string{}
	dec := json.NewDecoder(bytes.NewReader(plan))
	nextIsService := false
	for {
		tok, err := dec.Token()
		if err != nil {
			return found
		}
		s, isString := tok.(string)
		if nextIsService && isString && !contains(found, s) {
			found = append(found, s)
		}
		nextIsService = isString && s == "serviceName" && dec.More()
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

var imageLine = regexp.MustCompile(`(?m)^\s*image:\s*(\S+)\s*$`)

// imageOf returns the image reference in a GraphApi workspace file, or "" when the file has none.
func imageOf(yaml string) string {
	m := imageLine.FindStringSubmatch(yaml)
	if m == nil {
		return ""
	}
	return m[1]
}

// Cache holds one value per key, refreshed after its TTL.
// Every public request reads from here, so GitHub sees at most one call per key per window.
// The lock is held while loading, so concurrent callers wait for one load.
type Cache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
}

type cacheEntry struct {
	value any
	at    time.Time
}

func (c *Cache) Get(key string, ttl time.Duration, load func() (any, error)) (any, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if hit, ok := c.entries[key]; ok && time.Since(hit.at) < ttl {
		return hit.value, nil
	}
	value, err := load()
	if err != nil {
		return nil, err
	}
	if c.entries == nil {
		c.entries = map[string]cacheEntry{}
	}
	c.entries[key] = cacheEntry{value: value, at: time.Now()}
	return value, nil
}

// Budget allows limit calls per window, per key.
// Every click reaches the router while the budget lasts, so the latency shown is the latency measured.
// Past it the caller serves its last answer instead.
type Budget struct {
	limit  int
	window time.Duration
	mu     sync.Mutex
	stamps map[string][]time.Time
}

func NewBudget(limit int, window time.Duration) *Budget {
	return &Budget{limit: limit, window: window, stamps: map[string][]time.Time{}}
}

func (b *Budget) Take(key string, now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	recent := []time.Time{}
	for _, t := range b.stamps[key] {
		if now.Sub(t) < b.window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= b.limit {
		b.stamps[key] = recent
		return false
	}
	b.stamps[key] = append(recent, now)
	return true
}
