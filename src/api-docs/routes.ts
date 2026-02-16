import { Express, Request, Response } from 'express';
import { openApiSpec } from './swagger';

/**
 * HTML template for Swagger UI
 * Serves interactive API documentation interface
 * 
 * @returns HTML string with Swagger UI
 */
function getSwaggerUIHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>CYPHER ERP API - Swagger UI</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@3/swagger-ui.css">
        <style>
          html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
          }
          *, *:before, *:after {
            box-sizing: inherit;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: "Helvetica Neue",Helvetica,Arial,sans-serif;
            background: #fafafa;
          }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
        <script>
          window.onload = function() {
            window.ui = SwaggerUIBundle({
              url: "/api/docs/json",
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout",
              defaultModelsExpandDepth: 1,
              defaultModelExpandDepth: 1,
            })
          }
        </script>
      </body>
    </html>
  `;
}

/**
 * Register API documentation routes
 * 
 * Serves:
 * - GET /api/docs - Interactive Swagger UI
 * - GET /api/docs/json - OpenAPI specification JSON
 * 
 * @param app - Express application instance
 */
export function registerApiDocsRoutes(app: Express): void {
  /**
   * GET /api/docs
   * Serves interactive Swagger UI for API documentation
   * 
   * @param _req - Express request object
   * @param res - Express response object
   */
  app.get('/api/docs', (_req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getSwaggerUIHtml());
  });

  /**
   * GET /api/docs/json
   * Serves the complete OpenAPI 3.0 specification in JSON format
   * 
   * @param _req - Express request object
   * @param res - Express response object
   */
  app.get('/api/docs/json', (_req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(openApiSpec);
  });
}

export default registerApiDocsRoutes;
