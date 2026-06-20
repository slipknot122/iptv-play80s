#!/bin/bash
git filter-branch -f --env-filter '
    GIT_AUTHOR_NAME="IPTV Bot"
    GIT_AUTHOR_EMAIL="iptv-bot@local.com"
    GIT_COMMITTER_NAME="IPTV Bot"
    GIT_COMMITTER_EMAIL="iptv-bot@local.com"
' HEAD
