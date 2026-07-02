# tools/ssh-fleet

Fleet SSH wrapper with canonical aliases. Mirrors `~/.claude/tools/jw-ssh.sh` but with all 5 fleet hosts (myserver, bbw, jmain, jmint, pcb) + dedicated `known_hosts.<host>` files per the user memory `windows_openssh_known_hosts_lock.md` (Windows file-lock contention on concurrent ssh).

## Aliases

| Alias | Target |
|---|---|
| `myserver` / `hostinger` | Hostinger (jalenward.com) — `u541739162@77.37.32.7:65002` |
| `bbw` / `bbwadmin` | BBWADMIN — `Admin@192.168.0.232:22` |
| `jmain` | JMAIN direct-link — `Admin@10.10.10.2:22` |
| `jmint` | jmint Linux Mint — `jalen@192.168.0.71:22` |
| `pcb` | PCB direct ethernet — `Admin@10.10.20.1:22` |

## Run

```bash
bash tools/ssh-fleet/ssh-fleet.sh                       # show help + aliases
bash tools/ssh-fleet/ssh-fleet.sh --list                # list with details
bash tools/ssh-fleet/ssh-fleet.sh myserver              # interactive ssh
bash tools/ssh-fleet/ssh-fleet.sh jmint "uptime"        # one-shot command
bash tools/ssh-fleet/ssh-fleet.sh --scp file.txt myserver:public_html/
```

## Why dedicated known_hosts per host

Per user memory: concurrent `scp -r ... pcb:...` jobs lock `~/.ssh/known_hosts` (`FileShare.None`), producing `load_hostkeys: Permission denied` on unrelated ssh invocations. Each fleet host gets its own `~/.ssh/known_hosts.<name>` file so the lock contention is impossible.
