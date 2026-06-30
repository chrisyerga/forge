export default {
  providers: [
    {
      // Convex Auth issues tokens for this deployment. CONVEX_SITE_URL is
      // provided automatically by Convex at runtime.
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
