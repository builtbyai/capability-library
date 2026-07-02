# everything-search · sharp edges

## 1. Everything.exe HTTP server is per-user, not service

The HTTP server only runs while Everything.exe is foreground or minimized. If BBWADMIN restarts and the user doesn't reopen Everything, queries return ECONNREFUSED. Add Everything.exe to RunOnLogon AND check for the process before assuming the endpoint is up.

## 2. Excludes are configured per-Everything-install, not per-query

You cannot pass `--exclude node_modules` per-query. The exclusion lives in Everything's settings. Document the recommended exclude set (node_modules, .git, dist, build, AppData) in the runbook.

## 3. Fallback fd/ripgrep differs in glob semantics

Everything uses `*.ts` to match any .ts file recursively. `fd *.ts` matches only the cwd unless `--no-ignore` and the right depth. Normalize at the query layer; surface backend-used in result metadata so the user understands result deltas.

## 4. Result count is unbounded by default

Searching `e` matches everything-with-e. Default the API to a 200-result cap; surface `more available` to the UI; never stream millions to the browser.

## 5. Search index lag

NTFS volumes update Everything's index in ~1-2s after file creation. Network volumes (mapped SMB/Mega) can lag 30+ seconds OR never index at all. The recent-files toggle should warn the user that network paths may show stale results.

