# Logs Directory

This directory contains application logs when running locally.

## Log Files

- `api-gateway.log` - API Gateway service logs
- `api-gateway-error.log` - API Gateway error logs
- `hr-resource.log` - HR Resource service logs
- `matching-engine.log` - Matching Engine service logs
- `verification.log` - Verification service logs
- `edge-agent.log` - Edge Agent service logs
- `mock-ldap.log` - Mock LDAP server logs

## Log Rotation

Logs are automatically rotated when they exceed 10MB.
Old logs are compressed and kept for 7 days.

## Viewing Logs

```bash
# View all logs
npm run logs:all

# View specific service logs
npm run logs:hr
npm run logs:ldap

# Follow logs in real-time
tail -f logs/*.log
```
