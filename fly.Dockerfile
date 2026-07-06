# Thin wrapper over the published TREK image for Fly.io.
# Fly Machines allow only ONE volume per machine, but TREK keeps its SQLite
# database at /app/data and user uploads at /app/uploads. This image repoints
# both onto subdirectories of a single volume mounted at /data.
FROM mauriceboe/trek:latest

USER root

# Replace the image's data/uploads dirs with symlinks into the /data volume.
# (Symlink targets don't need to exist at build time; created at startup below.)
RUN rm -rf /app/data /app/uploads && \
    ln -s /data/db /app/data && \
    ln -s /data/uploads /app/uploads

# On boot the /data volume is empty, so recreate the directory tree the base
# image expects, fix ownership, then hand off to TREK's normal start command.
CMD ["sh", "-c", "mkdir -p /data/db/logs /data/uploads/files /data/uploads/covers /data/uploads/avatars /data/uploads/photos && chown -R node:node /data/db /data/uploads 2>/dev/null || true; cd /app/server && exec gosu node node --require tsconfig-paths/register dist/index.js"]
