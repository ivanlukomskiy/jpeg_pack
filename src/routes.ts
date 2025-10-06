import {
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  route("/", "./pages/one_block_test/one_block_test.tsx"),
  // pattern ^           ^ module file
] satisfies RouteConfig;
