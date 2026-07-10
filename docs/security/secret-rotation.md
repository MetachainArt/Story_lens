# Production secret rotation

Git history previously contained production-like credentials. Removing files from
the latest commit is not sufficient; every credential listed below must be
rotated before the rewritten repository is treated as clean.

## Rotation order

1. Put the site in a short maintenance window and create a PostgreSQL backup.
2. Rotate the PostgreSQL `storylens` password and update both `DATABASE_URL` and
   `DB_PASSWORD` in `/opt/storylens/deploy/.env.production`.
3. Generate a new JWT `SECRET_KEY` with `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
   Updating it signs out all existing browser sessions, which is expected.
4. Revoke and reissue Gemini, Kie.ai, OpenAI, and Supabase credentials that have
   ever appeared in a committed environment file.
5. Rebuild and restart the API, then verify `/health`, login, image generation,
   music generation, and speech-to-text.
6. Rewrite Git history only after the replacement credentials are active.

## Repository cleanup

Run the history rewrite from a fresh mirror clone after all collaborators have
stopped pushing:

```bash
git clone --mirror <repository-url> storylens-clean.git
cd storylens-clean.git
git filter-repo --invert-paths \
  --path .env \
  --path backend/.env.test \
  --path backend/reset_pw.py \
  --path backend/server.log \
  --path backend/_test_body.json
git push --force --mirror origin
```

Every existing clone must then be deleted and cloned again. Do not merge an old
branch after the rewrite because it can restore the removed secret history.
