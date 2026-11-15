import nextVitals from "eslint-config-next/core-web-vitals";
const config = [...nextVitals, { ignores: [".next/**", ".next-build/**", "node_modules/**", "tsconfig.tsbuildinfo"] }];
export default config;
