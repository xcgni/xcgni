# Pull-based deploy (Q0)

Trust model: GitHub holds NOTHING that can reach this server. CI publishes an image on
every green version tag; this server pulls on a timer, outbound-only.

## One-time setup (on the server, ~10 minutes)
1. Make the GHCR package public (repo -> Packages -> xcgni -> settings -> public).
   Preferred: then NO credential is needed anywhere. If you keep it private instead:
   create a classic PAT with ONLY read:packages, then `docker login ghcr.io` once.
2. Copy this repo's newest state to the app dir (last manual deploy ever), then:
     cp scripts/deploy-pull.sh /root/app/scripts/ && chmod +x /root/app/scripts/deploy-pull.sh
     cp deploy/xcgni-deploy.service deploy/xcgni-deploy.timer /etc/systemd/system/
     systemctl daemon-reload && systemctl enable --now xcgni-deploy.timer
3. Verify: systemctl list-timers | grep xcgni ; tail -f /var/log/xcgni-deploy.log

## Daily flow after that
Tag and push a version -> CI green -> image on GHCR -> live within ~5 minutes.

## Rollback
Set IMAGE_TAG=vX.Y.Z in /root/app/.env and run the deploy script once (or wait a tick):
the app recreates on the pinned image. Remove the line to return to latest.
