export const QUOTE_MEDIA_TEST_PLAN = `
  Browser-driven test for quote media rendering (drawings + customer photos).

  SETUP:
  1. [API] POST /api/drawing-images — Upload a small 1x1 red PNG as FormData with field "file" named "drawing.png".
     Use this JS to create the blob:
       const pngHeader = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,192,0,0,0,3,0,1,24,216,95,168,0,0,0,0,73,69,78,68,174,66,96,130]);
       const pngBlob = new Blob([pngHeader], { type: "image/png" });
     Note the returned "key" field as DRAWING_KEY.
  2. [API] POST /api/item-photos — Upload a small 1x1 JPEG as FormData with field "file" named "photo.jpg".
     Use this JS to create the blob:
       const jpegHeader = new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,217]);
       const jpegBlob = new Blob([jpegHeader], { type: "image/jpeg" });
     Note the returned "key" field as PHOTO_KEY.
  3. [API] POST /api/jobs with body {"name":"MediaTest Project","address":"123 Test Ave"} — note job ID as JOB_ID.
  4. [API] POST /api/quotes with body:
     {
       "sourceJobId": "<JOB_ID>",
       "customer": "MediaTest Customer",
       "divisionCode": "LJ",
       "mode": "revision",
       "snapshot": {
         "items": [
           {
             "itemNumber": 1,
             "itemRef": "W01",
             "title": "Test Window",
             "name": "Test Window",
             "category": "awning-window",
             "width": 1200,
             "height": 900,
             "quantity": 1,
             "frameType": "aluminium",
             "drawingImageKey": "<DRAWING_KEY>",
             "photos": [
               { "key": "<PHOTO_KEY>", "includeInCustomerPdf": true, "caption": "Site photo included" },
               { "key": "excluded-photo-key.jpg", "includeInCustomerPdf": false, "caption": "This should NOT render" }
             ],
             "specValues": {},
             "resolvedSpecs": { "frameType": "Aluminium" }
           }
         ],
         "totalsBreakdown": {
           "itemsSubtotal": 1000,
           "installationTotal": 0,
           "deliveryTotal": 0,
           "subtotalExclGst": 1000,
           "gstAmount": 150,
           "totalInclGst": 1150
         },
         "totals": {
           "cost": 500,
           "sell": 1000,
           "grossProfit": 500,
           "grossMargin": 50,
           "gpPerHour": 100,
           "totalLabourHours": 5
         },
         "customer": "MediaTest Customer",
         "divisionCode": "LJ",
         "lineItems": [],
         "assemblies": [
           { "name": "Test Window", "width": 1200, "height": 900, "quantity": 1 }
         ],
         "operations": []
       }
     }
     The response format is {"quote":{"id":"..."},"revision":{...},"isNewRevision":true}.
     Note the QUOTE_ID from the response field "quote.id".

  Test 1: Drawing image renders in quote preview
  5. [New Context] Create a new browser context.
  6. [Browser] Navigate to the URL path /quote/<QUOTE_ID>/preview
     WARNING: The path must start with /quote/ (singular, no trailing "s"). The route is /quote/:id/preview. Using /quotes/ will 404.
  7. [Wait] Wait for the schedule section to appear (data-testid="schedule-item-0"). Allow up to 10 seconds.
  8. [Verify]
     - The drawing image element is visible (data-testid="img-drawing-0")
     - The drawing image src attribute contains "/api/drawing-images/"
     - No fallback element exists for drawing (data-testid="fallback-drawing-0" should NOT exist)

  Test 2: Included customer photo renders
  9. [Verify]
     - The photos section container is visible (data-testid="photos-section-0")
     - The included photo img element is visible (data-testid="img-photo-0-0")
     - The photo src attribute contains "/api/item-photos/"
     - The caption text "Site photo included" is visible
     - No photo fallback element exists (data-testid="fallback-photo-0-0" should NOT exist)

  Test 3: Excluded customer photo does NOT render
  10. [Verify]
      - There is NO element with data-testid="img-photo-0-1"
      - The text "This should NOT render" does NOT appear on the page

  Test 4: No broken image elements appear
  11. [Verify]
      - No elements matching data-testid pattern "fallback-" are present on the page

  CLEANUP:
  12. [API] DELETE /api/quotes/<QUOTE_ID>
  13. [API] DELETE /api/jobs/<JOB_ID>
`;

export const QUOTE_MEDIA_TECHNICAL_DOCS = `
  ROUTING INFORMATION:
  The client router uses wouter with these routes:
    <Route path="/quotes/:id/preview" component={QuotePreview} />
    <Route path="/quote/:id/preview" component={QuotePreview} />
    <Route path="/quote/:id" component={QuoteDetail} />
    <Route path="/quotes" component={QuotesList} />

  Both /quote/:id/preview and /quotes/:id/preview are valid preview routes.

  API endpoints (all use plural "quotes"):
  - POST /api/quotes → {"quote":{"id":"..."},"revision":{...},"isNewRevision":true}
  - GET /api/quotes/:id/preview-data → PreviewData
  - DELETE /api/quotes/:id

  Upload endpoints:
  - POST /api/drawing-images (multipart, field "file") → { key: string }
  - POST /api/item-photos (multipart, field "file") → { key: string }
  - GET /api/drawing-images/:key → image/png
  - GET /api/item-photos/:key → image/jpeg

  Key data-testid attributes:
  - schedule-item-{index}: Schedule item container
  - img-drawing-{index}: Drawing image element
  - fallback-drawing-{index}: Drawing fallback (shown when image fails to load)
  - photos-section-{index}: Photos section container
  - img-photo-{itemIndex}-{photoIndex}: Photo image element
  - fallback-photo-{itemIndex}-{photoIndex}: Photo fallback (shown when image fails to load)
`;
