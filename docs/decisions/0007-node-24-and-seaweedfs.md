# 0007 Node 24, and SeaweedFS for local object storage

Status: Accepted
Date: 1 October 2026
Decided by: nas
Supersedes: the Node version and the MinIO choice in 0005

## Context

Two things changed while setting up the workspace under 0005:

- 0005 pinned Node 22 LTS. The workspace is standardised on nvm's `stable`, which is Node 24 (24.21 at the time of this decision). Node 24 is an LTS line.
- 0005 chose MinIO for local S3-compatible storage. The MinIO image can no longer be pulled: Docker Hub reports that `minio/minio` does not exist, and MinIO's own registry (`quay.io/minio/minio`) refuses anonymous pulls.

## Decision

- **Node 24**, pinned in `.nvmrc` and in `engines` (`>=24 <25`). pnpm is provided through corepack from the `packageManager` field.
- **SeaweedFS** (Apache-2.0) replaces MinIO in Docker Compose as the S3-compatible store for the evidence store. The image is pinned (`chrislusf/seaweedfs:4.48`), and local credentials are in `infra/seaweedfs/s3.json`.

Code talks to object storage only through the S3 API, so the local store can be swapped without code changes. Production storage is decided with hosting (0005 open points).

## Consequences

- `@types/node` follows Node 24.
- Anonymous S3 access is refused locally, as it will be in production. Every request is signed with the local credentials in `.env.example`.
- S3 features beyond basic object storage, such as object lock for write-once evidence, need checking against both SeaweedFS and the production store before being relied on.

## Open points

None.
