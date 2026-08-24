<script setup>
import BookmarkCard from './BookmarkCard.vue'

defineProps({
  bookmarks: { type: Array, required: true },
  title: { type: String, required: true },
  meta: { type: String, required: true },
  trashView: Boolean,
})
const emit = defineEmits(['add', 'manage', 'open', 'favorite', 'note', 'menu', 'context-menu', 'drag-start', 'drop'])
</script>

<template>
  <section class="content" aria-live="polite">
    <div class="view-heading">
      <div>
        <h1>{{ title }}</h1>
        <p>{{ meta }}</p>
      </div>
      <button class="button secondary" type="button" @click="emit('manage')">{{ trashView ? '清空废纸篓' : '管理分类' }}</button>
    </div>

    <div v-if="bookmarks.length" class="bookmark-grid">
      <BookmarkCard
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        :trash-view="trashView"
        @open="emit('open', $event)"
        @favorite="emit('favorite', $event)"
        @note="emit('note', $event)"
        @menu="(bookmark, event) => emit('menu', bookmark, event)"
        @context-menu="(bookmark, event) => emit('context-menu', bookmark, event)"
        @drag-start="(id, event) => emit('drag-start', id, event)"
        @drop="emit('drop', $event)"
      />
    </div>

    <div v-else class="empty-state">
      <div class="empty-mark">FL</div>
      <h2>这里还没有网址</h2>
      <p>添加一张卡片，或切换到其他分类。</p>
      <button class="button primary" type="button" @click="emit('add')">添加网址</button>
    </div>
  </section>
</template>
