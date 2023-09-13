#/bin/bash
export $(cat .env | xargs)
npm run build && NODE_PATH=dist/ node dist/sample/image
