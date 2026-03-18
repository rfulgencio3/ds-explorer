package main

import (
	"io/fs"
	"log"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var liveReloadState = newLiveReloadState()

type liveReloadTracker struct {
	version   atomic.Int64
	mu        sync.Mutex
	listeners map[chan int64]struct{}
}

func newLiveReloadState() *liveReloadTracker {
	t := &liveReloadTracker{
		listeners: make(map[chan int64]struct{}),
	}
	t.version.Store(time.Now().UnixMilli())
	return t
}

func (t *liveReloadTracker) Version() int64 {
	return t.version.Load()
}

func (t *liveReloadTracker) Subscribe() (chan int64, func()) {
	ch := make(chan int64, 1)

	t.mu.Lock()
	t.listeners[ch] = struct{}{}
	t.mu.Unlock()

	return ch, func() {
		t.mu.Lock()
		delete(t.listeners, ch)
		t.mu.Unlock()
		close(ch)
	}
}

func (t *liveReloadTracker) Notify() {
	version := time.Now().UnixMilli()
	t.version.Store(version)

	t.mu.Lock()
	defer t.mu.Unlock()

	for ch := range t.listeners {
		select {
		case ch <- version:
		default:
		}
	}
}

func watchLiveReloadChanges(roots []string, interval time.Duration) {
	state := make(map[string]time.Time)
	_, _ = scanLiveReloadFiles(roots, state)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		changed, err := scanLiveReloadFiles(roots, state)
		if err != nil {
			log.Printf("live reload watcher error: %v", err)
			continue
		}
		if changed {
			liveReloadState.Notify()
		}
	}
}

func scanLiveReloadFiles(roots []string, state map[string]time.Time) (bool, error) {
	seen := make(map[string]struct{})
	changed := false

	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				return nil
			}
			if !shouldWatchFile(path) {
				return nil
			}

			info, err := d.Info()
			if err != nil {
				return err
			}

			seen[path] = struct{}{}
			last, ok := state[path]
			if !ok || info.ModTime().After(last) {
				state[path] = info.ModTime()
				if ok {
					changed = true
				}
			}
			return nil
		})
		if err != nil {
			return false, err
		}
	}

	for path := range state {
		if _, ok := seen[path]; !ok {
			delete(state, path)
			changed = true
		}
	}

	return changed, nil
}

// watchedExtensions is the set of file extensions monitored for live reload.
// To watch a new file type: add its extension here.
var watchedExtensions = map[string]bool{
	".html": true,
	".css":  true,
	".js":   true,
	".json": true,
	".svg":  true,
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".ico":  true,
	".webp": true,
}

func shouldWatchFile(path string) bool {
	return watchedExtensions[strings.ToLower(filepath.Ext(path))]
}
