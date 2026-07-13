<script lang="ts">
  export let data;
</script>

<div class="flex max-w-2xl flex-col gap-6">
  <div>
    <p class="label mb-1">Raw export</p>
    <p class="text-sm text-muted">
      Download one anonymized row per consented user - attributes plus per-category ratings -
      for analysis in R, Python, or a notebook. No identifiers, no free text. Released only if the
      whole consented set clears the {data.minCell}-minimum floor. This is the dataset the dashboard
      cannot fully express; treat it with the same care as any human-subjects data.
    </p>
  </div>
  <div class="flex gap-3">
    <a href="/admin/export/data.csv" class="btn-primary" download>Download CSV</a>
  </div>
  <p class="text-xs text-muted">
    Each row is a user reduced to consented attributes and aggregate ratings. Because rare attribute
    combinations can re-identify, downstream use must keep aggregates above the floor and must never
    attempt re-identification.
  </p>
</div>
