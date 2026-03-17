# Token Efficiency Checklist

Use this checklist for each implementation batch.

- [ ] Mapped file paths before broad exploration.
- [ ] Grouped independent reads/searches into parallel tool calls.
- [ ] Avoided duplicate reads on unchanged files.
- [ ] Kept summaries delta-first (decision -> evidence).
- [ ] Ran targeted verification for touched scope.
- [ ] Logged known unrelated failures explicitly (if any).
- [ ] Avoided verbose command-output dumps in final report.
