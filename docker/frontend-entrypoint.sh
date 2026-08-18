#!/bin/sh
set -eu

language="${FRONTEND_LANGUAGE:-en}"
site_visibility="${FRONTEND_SITE_VISIBILITY:-local}"
api_url="${FRONTEND_API_URL:-}"
max_upload_size_mb="${FRONTEND_MAX_UPLOAD_SIZE_MB:-15}"

case "$language" in
  en|es) ;;
  *)
    echo "Unsupported FRONTEND_LANGUAGE '$language'; falling back to 'en'." >&2
    language="en"
    ;;
esac

case "$site_visibility" in
  public|local) ;;
  *)
    echo "Unsupported FRONTEND_SITE_VISIBILITY '$site_visibility'; falling back to 'local'." >&2
    site_visibility="local"
    ;;
esac

cat > /usr/share/nginx/html/config.js <<EOF
window.__VITALITYNUTRI_CONFIG__ = {
  language: "$language",
  siteVisibility: "$site_visibility",
  apiUrl: "$api_url",
  maxUploadSizeMb: Number("$max_upload_size_mb") || 15
};
EOF