# fleet-control · sharp edges

## 1. Hyper-V port reservation eats 9900-9901 on node-a

Per `fleet_gui_stream_server.md`, the PCA `hns` reservation at boot can claim 9900-9901 before the GUI server binds. Detection: node-a `netstat -ano | findstr :9900` shows no listener but `netsh interface ipv4 show excludedportrange protocol=tcp` lists 9900 in the range. Fix: `netsh int ipv4 add excludedportrange protocol=tcp startport=9902 numberofports=2 store=persistent` to push the reservation up.

## 2. Tailscale + direct-link race for node-b address

node-b has THREE plausible addresses: `10.0.0.2` (P2P direct), `192.168.1.216` (LAN), and a Tailscale 100.x address. Order of preference matters — direct link is sub-ms RTT; LAN is ~2ms; Tailscale is encrypted-relay 50+ms. Identity detector must try in that order and record which won.

## 3. node-c kernel ACPI storm (gpe16) can spike CPU silently

Per `node-c_kernel124_gpe16_acpi_storm.md`, the Mac Pro 6,1 hardware on kernel 6.8.0-124 fires GPE16 interrupts at 10k+/sec when not masked. `gpe16-mask.service` should be running. Health collector should check `/sys/firmware/acpi/interrupts/gpe16` count delta and flag `degraded` if growing.

## 4. NSSM scheduled-task duplicates on node-a

Per `node-a_nssm_services.md`, Syncthing/Ollama/SnapUploader run as NSSM-wrapped services AND there are matching scheduled tasks intentionally Disabled. The service-status query must not list the Disabled tasks as `failed` — filter them out by name OR check `Disabled` flag before classifying.

## 5. GUI broker action without auth = remote code execution

The node-a GUI broker accepts shell commands. Without a strict bearer-token check, anyone on LAN can hit it. The capability MUST refuse to dispatch a privileged action without a valid `FLEET_GUI_BROKER_TOKEN` AND log every dispatch with `from:<source-ip>` for audit.

## 6. ARP pinning on node-c Sunshine prevents Moonlight disconnects

Per `node-c_sunshine_arp_pin_fix.md`, mid-stream `ENETUNREACH` is ARP staleness, NOT firewall/encoder. `sunshine-arp-pin.service` must be in the service status check; missing or stopped = streaming-related alerts incoming.

## 7. Direct ethernet link assumption (10.10.20.x BBW↔PCC)

Per `bbw_pcc_direct_link.md`, BBW=10.10.20.2 / PCC=10.10.20.1 via P2P cable; sub-ms RTT; ufw open for stream/SSH/Sunshine on that subnet. If you add PCC to the fleet config, route via 10.10.20.1 first.
