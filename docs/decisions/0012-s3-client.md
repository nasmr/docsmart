# 0012 S3 client for the evidence store

Status: Accepted
Date: 2 October 2026
Decided by: nas

## Context

The evidence store (SVC-EVID, build plan B1) keeps templates, uploaded source documents and generated versions in S3-compatible object storage: SeaweedFS locally (decision 0007), and a hosted store once hosting is decided. No decision lists an S3 client.

## Decision

`packages/platform` uses `@aws-sdk/client-s3` (Apache-2.0; 3.1144 at the time of this decision), AWS's official client. Only the platform package depends on it. Other code goes through the evidence store's interface, which addresses objects by their SHA-256.

## Why

- It works with SeaweedFS and with every S3-compatible host, so the hosting decision stays open.
- It is the most widely used and maintained S3 client.

## Consequences

- The SDK brings in many packages. That weight stays in `packages/platform`.
- Tests run against SeaweedFS in Docker Compose, and through an in-memory store that implements the same interface.

## Open points

None.
