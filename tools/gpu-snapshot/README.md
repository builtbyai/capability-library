# tools/gpu-snapshot

Collect GPU + VRAM telemetry from BBWADMIN (local), JMAIN (ssh `Admin@10.10.10.2`), and jmint (ssh `jalen@192.168.0.71`). Output as text or JSON.

## Run

```bash
node tools/gpu-snapshot/snapshot.mjs            # text table
node tools/gpu-snapshot/snapshot.mjs --json     # JSON for piping to gpu-router
```

## Output

```
GPU SNAPSHOT
============
[OK] bbwadmin   #0 NVIDIA GeForce RTX 4090 18432/24564MB (75%) util=82% 71°C
[OK] jmain      #0 NVIDIA GeForce RTX 3090 4096/24564MB (16%) util=12% 52°C
[AMD] jmint     (raw rocm-smi):
{ "card0": { "GPU use (%)": "0", ... } }
```

## Dependencies

- `nvidia-smi` (NVIDIA hosts) OR `rocm-smi` (AMD hosts) installed locally
- SSH keys for remote hosts (uses dedicated `~/.ssh/known_hosts.<host>` per `ssh-fleet` convention)

## Composing

```bash
# Feed gpu-router capability
node tools/gpu-snapshot/snapshot.mjs --json | curl -X POST http://127.0.0.1:5121/api/gpu/snapshot -d @-

# Find the host with most free VRAM
node tools/gpu-snapshot/snapshot.mjs --json | \
  jq '.snapshots | map(select(.vendor=="nvidia")) | sort_by(.vramTotalMb - .vramUsedMb) | reverse | .[0]'
```
