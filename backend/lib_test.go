package main

import (
	"errors"
	"slices"
	"testing"
	"time"
)

func TestSubgraphsOfListsEachOnceInPlanOrder(t *testing.T) {
	plan := []byte(`{"kind":"QueryPlan","node":{"kind":"Sequence","nodes":[
		{"kind":"Fetch","serviceName":"records"},
		{"kind":"Flatten","node":{"kind":"Fetch","serviceName":"reviews"}},
		{"kind":"Fetch","serviceName":"records"}]}}`)
	if got := subgraphsOf(plan); !slices.Equal(got, []string{"records", "reviews"}) {
		t.Errorf("got %v", got)
	}
}

func TestSubgraphsOfIsEmptyForNoPlan(t *testing.T) {
	if got := subgraphsOf(nil); len(got) != 0 {
		t.Errorf("got %v", got)
	}
}

func TestImageOfReadsTheImageLine(t *testing.T) {
	yaml := "spec:\n  parameters:\n    graph: storefront\n    image: ghcr.io/x/y@sha256:abc\n"
	if got := imageOf(yaml); got != "ghcr.io/x/y@sha256:abc" {
		t.Errorf("got %q", got)
	}
}

func TestImageOfIsEmptyWithoutOne(t *testing.T) {
	if got := imageOf("kind: Namespace\n"); got != "" {
		t.Errorf("got %q", got)
	}
}

func TestCacheLoadsOnceInsideTheWindow(t *testing.T) {
	var c Cache
	calls := 0
	load := func() (any, error) { calls++; return calls, nil }
	for range 2 {
		if v, _ := c.Get("k", time.Minute, load); v != 1 {
			t.Errorf("got %v, want 1", v)
		}
	}
	if calls != 1 {
		t.Errorf("loaded %d times, want 1", calls)
	}
}

func TestCacheDoesNotRememberAFailure(t *testing.T) {
	var c Cache
	calls := 0
	load := func() (any, error) {
		calls++
		if calls == 1 {
			return nil, errors.New("down")
		}
		return calls, nil
	}
	if _, err := c.Get("k", time.Minute, load); err == nil {
		t.Fatal("want the first load's error")
	}
	if v, _ := c.Get("k", time.Minute, load); v != 2 {
		t.Errorf("got %v, want 2", v)
	}
}

func TestBudgetAllowsTheLimitThenRefusesUntilItSlides(t *testing.T) {
	b := NewBudget(2, time.Second)
	at := func(ms int) time.Time { return time.UnixMilli(int64(ms)) }
	steps := []struct {
		key  string
		ms   int
		want bool
	}{
		{"q", 0, true}, {"q", 10, true}, {"q", 20, false}, {"other", 20, true}, {"q", 1001, true},
	}
	for _, s := range steps {
		if got := b.Take(s.key, at(s.ms)); got != s.want {
			t.Errorf("Take(%s, %d) = %v, want %v", s.key, s.ms, got, s.want)
		}
	}
}
