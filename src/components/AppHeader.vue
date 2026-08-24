<script setup>
defineProps({
  roots: { type: Array, required: true },
  currentView: { type: String, required: true },
  activeRootId: { type: String, required: true },
  theme: { type: String, required: true },
})
const emit = defineEmits(['select', 'manage', 'cycle-theme', 'settings'])
</script>

<template>
  <header class="header">
    <nav class="top-nav" aria-label="网址分类" @contextmenu.prevent="emit('manage', $event)">
      <button
        v-for="category in roots"
        :key="category.id"
        type="button"
        :class="{ active: activeRootId === category.id }"
        @click="emit('select', `category:${category.id}`)"
      >
        <span>{{ category.name }}</span>
      </button>
      <button type="button" :class="{ active: currentView === 'inbox' }" @click="emit('select', 'inbox')"><span>收集箱</span></button>
      <button class="fly-button" type="button" :class="{ active: currentView === 'quick' }" title="网页快开" aria-label="网页快开" @click="emit('select', 'quick')">
        <i class="iconfont icon-fly" aria-hidden="true" />
      </button>
      <span class="nav-spacer" />
      <button class="round-button theme-button" type="button" title="切换主题" aria-label="切换主题" @click.stop="emit('cycle-theme')">
        <i class="iconfont" :class="theme === 'dark' ? 'icon-dark' : theme === 'light' ? 'icon-light' : 'icon-system'" aria-hidden="true" />
      </button>
      <button class="round-button" type="button" title="设置" aria-label="设置" @click.stop="emit('settings')">
        <i class="iconfont icon-setting" aria-hidden="true" />
      </button>
    </nav>
  </header>
</template>
