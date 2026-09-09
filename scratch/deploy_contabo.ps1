tar -czf dist.tar.gz -C dist .
scp dist.tar.gz root@169.58.168.107:/tmp/dist.tar.gz
ssh root@169.58.168.107 "bash -c 'for c in `docker ps -q --filter name=yjttbctaekty8zb5ode0hiu4`; do docker cp /tmp/dist.tar.gz "'$c'":/tmp/ && docker exec "'$c'" tar -xzf /tmp/dist.tar.gz -C /app/dist; done; rm -f /tmp/dist.tar.gz'"
Remove-Item dist.tar.gz
Write-Host "DEPLOY_SUCCESS"
