<script setup>
import { initials } from '../lib/core.mjs'
import { displayHost, safeColor } from '../composables/useFunLink.js'

const props = defineProps({ bookmark: { type: Object, required: true }, trashView: Boolean })
const emit = defineEmits(['open', 'favorite', 'note', 'menu', 'context-menu', 'drag-start', 'drop'])
</script>

<template>
  <article
    class="bookmark-card"
    :draggable="!trashView"
    @contextmenu.prevent="emit('context-menu', bookmark, $event)"
    @dragstart="emit('drag-start', bookmark.id, $event)"
    @dragover.prevent
    @drop.prevent="emit('drop', bookmark.id)"
  >
    <button class="card-open" type="button" :aria-label="`打开 ${bookmark.title}`" @click="emit('open', bookmark)" />
    <div
      class="bookmark-icon"
      :class="{ image: bookmark.iconType === 'image' }"
      :style="{ '--bookmark-color': safeColor(bookmark.color) }"
    >
      <img v-if="bookmark.iconType === 'image' && bookmark.icon" :src="bookmark.icon" alt="" loading="lazy" />
      <template v-else>{{ bookmark.icon || initials(bookmark.title) }}</template>
    </div>
    <div class="bookmark-copy">
      <h2 :title="bookmark.title">{{ bookmark.title }}</h2>
      <p :title="bookmark.description || displayHost(bookmark.url)">{{ bookmark.description || displayHost(bookmark.url) }}</p>
    </div>
    <div class="card-actions">
      <button
        v-if="bookmark.note"
        class="card-note"
        type="button"
        :aria-label="`打开 ${bookmark.title} 的笔记`"
        title="卡片笔记"
        @click.stop="emit('note', bookmark)"
      >
        <span aria-hidden="true">≡</span>
      </button>
      <button
        type="button"
        class="favorite-button"
        :class="{ active: bookmark.favorite }"
        :aria-label="bookmark.favorite ? '取消常用' : '加入常用'"
        title="常用"
        @click.stop="emit('favorite', bookmark)"
      >
        {{ bookmark.favorite ? '★' : '☆' }}
      </button>
      <button type="button" aria-label="更多操作" title="更多操作" @click.stop="emit('menu', bookmark, $event)">
        ⋮
      </button>
    </div>
  </article>
</template>
