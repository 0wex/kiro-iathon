#!/usr/bin/env bash
# Builds and deploys the citizen risk map to the AWS account of the current
# credentials: SAM stack (template.yaml), then the web app to its bucket.
# Run it from a team session with the team's AWS account, never from an agent.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

stack_name="${STACK_NAME:-fen-mapa-ciudadano}"
aws_region="${AWS_REGION:-us-east-1}"
bedrock_model_id="${BEDROCK_MODEL_ID:-amazon.nova-lite-v1:0}"
service_version="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

for required_command in sam aws pnpm node; do
	if ! command -v "$required_command" >/dev/null 2>&1; then
		echo "Missing required command: $required_command" >&2
		exit 1
	fi
done

stack_output() {
	aws cloudformation describe-stacks \
		--stack-name "$stack_name" \
		--region "$aws_region" \
		--query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
		--output text
}

deploy_stack() {
	sam deploy \
		--template-file template.yaml \
		--stack-name "$stack_name" \
		--region "$aws_region" \
		--resolve-s3 \
		--capabilities CAPABILITY_IAM \
		--no-confirm-changeset \
		--no-fail-on-empty-changeset \
		--parameter-overrides \
		"BedrockModelId=$bedrock_model_id" \
		"ServiceVersion=$service_version" \
		"PublicUrl=$1"
}

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Bundling apps/server for Lambda"
pnpm --filter server build:lambda

# BETTER_AUTH_URL and ALLOWED_ORIGINS need the CloudFront URL, which only
# exists after the first deploy: a new stack is deployed twice.
web_url="$(stack_output WebUrl 2>/dev/null || true)"
if [[ "$web_url" == "None" ]]; then
	web_url=""
fi

echo "==> Deploying stack $stack_name to $aws_region"
deploy_stack "$web_url"
if [[ -z "$web_url" ]]; then
	web_url="$(stack_output WebUrl)"
	echo "==> Second pass with PublicUrl=$web_url"
	deploy_stack "$web_url"
fi

web_bucket="$(stack_output WebBucketName)"
distribution_id="$(stack_output DistributionId)"

echo "==> Building apps/web against $web_url"
VITE_SERVER_URL="$web_url" pnpm --filter web build

echo "==> Uploading apps/web to s3://$web_bucket"
aws s3 sync apps/web/dist "s3://$web_bucket" --delete --region "$aws_region"
aws cloudfront create-invalidation \
	--distribution-id "$distribution_id" \
	--paths "/*" \
	--query "Invalidation.Id" \
	--output text

echo
echo "Web: $web_url"
echo "Demo (register in the portal): $web_url/demo"
