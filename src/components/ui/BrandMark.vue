<script setup lang="ts">
defineProps<{ compact?: boolean }>()
</script>
<template>
  <RouterLink to="/" class="brand" aria-label="Scroll Studio 首页"
    ><span class="brand-symbol"><i></i><i></i><i></i></span
    ><span v-if="!compact"
      >scroll<span class="brand-light">studio</span><sup>®</sup></span
    ></RouterLink
  >
</template>
