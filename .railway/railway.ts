import { defineRailway, github, project, service, volume } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "daen-web";
export default defineRailway(() => {
  const data = volume("daen-web-volume", {
    region: "sfo", sizeMB: 500, allowOnlineResize: true,
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
  });
  const daenWeb = service("daen-web", {
    source: github("TeamDeaNBbang/DeaNBbang", { branch: "main", checkSuites: true }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: { "sfo": 1 },
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 },
    volumeMounts: { "/data": data },
  });

  return project("daenbbang", {
    variables: { managed: false },
    resources: [data, daenWeb],
  });
});
