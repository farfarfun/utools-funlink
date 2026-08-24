<script setup>
defineProps({
  roots: { type: Array, required: true },
  currentView: { type: String, required: true },
  activeRootId: { type: String, required: true },
})
const emit = defineEmits(['select'])
</script>

<template>
  <nav class="primary-nav" aria-label="网址分类">
    <button type="button" :class="{ active: currentView === 'all' }" @click="emit('select', 'all')">全部</button>
    <button
      v-for="category in roots"
      :key="category.id"
      type="button"
      :class="{ active: activeRootId === category.id }"
      @click="emit('select', `category:${category.id}`)"
    >
      {{ category.name }}
    </button>
    <span class="nav-spacer" />
    <button type="button" :class="{ active: currentView === 'favorites' }" @click="emit('select', 'favorites')">
      <span aria-hidden="true" class="nav-symbol star" />常用
    </button>
    <button type="button" :class="{ active: currentView === 'quick' }" @click="emit('select', 'quick')">
      <span aria-hidden="true" class="nav-symbol rocket" />快开
    </button>
    <button type="button" :class="{ active: currentView === 'inbox' }" @click="emit('select', 'inbox')">
      <span aria-hidden="true" class="nav-symbol inbox" />收集箱
    </button>
  </nav>
</template>
