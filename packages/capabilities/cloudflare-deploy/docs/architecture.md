# cloudflare-deploy · architecture

```
deploy request → run preDeployHooks
                    │
                    ▼ (exit 0?)
                    │
            yes ───┴─── no → fail with stage='pre-hook'; no upload
            ▼
  hashLocalBundle(source/**) → localHash
            │
            ▼
  wrangler pages deploy / wrangler deploy
            │
            ▼ (success)
  fetchLiveBundle(deploymentUrl) → liveHash
            │
            ▼
  match := localHash === liveHash
            │
            ▼
  emit cf.deploy.completed { ..., localHash, liveHash, hashMatch }
  emit cf.deploy.hash-verified { match }
            │
            ▼ (match=false → notify)
  jobs.enqueue('notify', 'dispatch', { source:'cloudflare-deploy', severity:'error', ... })
```

Pre-hooks are sequential. Hash function: sha256 over (sorted) `(path, sha256(bytes))` tuples — order-independent so file-listing differences don't false-mismatch.
