export function formatComposeCommand(profile: string): string {
  return `bash deploy/scripts/deploy.sh postgres up --profile ${profile}`
}
