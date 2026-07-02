#!/usr/bin/env bash
# ssh-fleet — thin wrapper around ssh + scp with canonical fleet aliases.
# Mirrors ~/.claude/tools/jw-ssh.sh but with explicit fleet hosts + dedup'd
# known_hosts files to dodge the Windows file-lock contention bug
# (see user memory: windows_openssh_known_hosts_lock.md).
#
# Aliases:
#   myserver      Hostinger (jalenward.com via u541739162@77.37.32.7:65002)
#   bbw           BBWADMIN (via 192.168.0.232 or 10.10.10.x)
#   jmain         JMAIN    (10.10.10.2 direct-link preferred)
#   jmint         jmint    (jalen@192.168.0.71)
#   pcb           PCB     (per direct ethernet link memory)
#
# Usage:
#   ssh-fleet myserver "ls -la public_html/"
#   ssh-fleet jmint "systemctl status sunshine"
#   ssh-fleet --scp local.txt myserver:public_html/
#
# All hosts use a dedicated UserKnownHostsFile to avoid the
# "load_hostkeys: Permission denied" race documented in user memory.

set -u

declare -A HOSTS=(
  [myserver]="u541739162@77.37.32.7:65002:hostinger"
  [hostinger]="u541739162@77.37.32.7:65002:hostinger"
  [bbw]="Admin@192.168.0.232:22:bbwadmin"
  [bbwadmin]="Admin@192.168.0.232:22:bbwadmin"
  [jmain]="Admin@10.10.10.2:22:jmain"
  [jmint]="jalen@192.168.0.71:22:jmint"
  [pcb]="Admin@10.10.20.1:22:pcb"
)

KNOWN_HOSTS_DIR="$HOME/.ssh"

resolve() {
  local alias="$1"
  local val="${HOSTS[$alias]:-}"
  if [ -z "$val" ]; then
    echo "ssh-fleet: unknown host alias '$alias'. Known: ${!HOSTS[*]}" >&2
    exit 2
  fi
  echo "$val"
}

case "${1:-}" in
  ""|-h|--help)
    cat <<HELP
ssh-fleet — fleet SSH wrapper

USAGE
  ssh-fleet <alias> [command...]
  ssh-fleet --scp <src> <alias>:<dst>
  ssh-fleet --list

ALIASES
$(for k in "${!HOSTS[@]}"; do
    printf "  %-12s %s\n" "$k" "${HOSTS[$k]%%:*}"
  done)
HELP
    exit 0
    ;;
  --list)
    for k in "${!HOSTS[@]}"; do
      printf "%-12s %s\n" "$k" "${HOSTS[$k]}"
    done | sort -u
    exit 0
    ;;
  --scp)
    shift
    src="$1"
    dst="$2"
    alias="${dst%%:*}"
    path="${dst#*:}"
    val=$(resolve "$alias")
    IFS=':' read -r user_at_host port kh <<<"$val"
    exec scp -P "$port" -o "UserKnownHostsFile=$KNOWN_HOSTS_DIR/known_hosts.$kh" "$src" "$user_at_host:$path"
    ;;
  *)
    alias="$1"
    shift || true
    val=$(resolve "$alias")
    IFS=':' read -r user_at_host port kh <<<"$val"
    if [ "$#" -eq 0 ]; then
      exec ssh -p "$port" -o "UserKnownHostsFile=$KNOWN_HOSTS_DIR/known_hosts.$kh" "$user_at_host"
    else
      exec ssh -p "$port" -o "UserKnownHostsFile=$KNOWN_HOSTS_DIR/known_hosts.$kh" "$user_at_host" "$@"
    fi
    ;;
esac
