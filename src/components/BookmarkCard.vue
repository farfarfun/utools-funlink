<script setup>
import { computed } from 'vue'
import { initials } from '../lib/core.mjs'
import { displayHost, safeColor } from '../composables/useFunLink.js'

const props = defineProps({ bookmark: { type: Object, required: true }, trashView: Boolean })
const emit = defineEmits(['open', 'note', 'context-menu', 'drag-start', 'drop'])
// 只用本地图片（用户上传后存成 data URL），不向任何第三方 favicon 服务发请求。
const iconImage = computed(() => (props.bookmark.iconType === 'image' ? props.bookmark.iconData : '') || '')
</script>

<template>
  <article
    class="bookmark-card"
    :draggable="!trashView"
    @click="emit('open', bookmark)"
    @contextmenu.prevent="emit('context-menu', bookmark, $event)"
    @dragstart="emit('drag-start', bookmark.id, $event)"
    @dragover.prevent
    @drop.prevent="emit('drop', bookmark.id)"
  >
    <span
      class="bookmark-icon"
      :class="{ image: Boolean(iconImage) }"
      role="button"
      tabindex="0"
      :aria-label="`打开 ${bookmark.title} 的笔记`"
      :style="{ '--bookmark-color': safeColor(bookmark.color), '--icon-size': `${bookmark.iconSize || 16}px` }"
      @click.stop="emit('note', bookmark)"
      @keydown.enter.stop="emit('note', bookmark)"
      @keydown.space.prevent.stop="emit('note', bookmark)"
    >
      <img v-if="iconImage" :src="iconImage" alt="" />
      <span v-else :class="{ 'emoji-text': bookmark.icon === '👌' }">{{ bookmark.icon || initials(bookmark.title) }}</span>
    </span>
    <div class="bookmark-copy">
      <h2 :title="bookmark.title">{{ bookmark.title }}</h2>
      <p :title="bookmark.description || displayHost(bookmark.url)">
        <i v-if="bookmark.hasNote || bookmark.note" class="iconfont icon-remarks note-mark" aria-hidden="true" />
        <span>{{ bookmark.description || displayHost(bookmark.url) }}</span>
      </p>
    </div>
  </article>
</template>
