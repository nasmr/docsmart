# Shared schemas

**Decision:** 0005 item 6
**Milestone:** M1
**Status:** Not started

## What goes here

Zod schemas for the API's requests and responses. The API validates with them and generates its OpenAPI contract from them; the web app uses the same schemas and types.

## Rules this code must hold

- The API contract is generated from these schemas, never written by hand.
- No business logic here: shapes and validation only.

## References

Build plan §5 (front end against the API contract); decision 0005
