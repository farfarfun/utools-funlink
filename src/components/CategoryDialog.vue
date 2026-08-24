<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  categories: { type: Array, required: true },
  categoryCount: { type: Function, required: true },
})
const emit = defineEmits(['add', 'action'])
const dialog = ref(null)
const rootName = ref('')
const popoverName = ref('')
const expandedIds = ref([])
const draggedId = ref('')
const popover = reactive({ id: '', type: '' })
const roots = computed(() => props.categories.filter(category => !category.parentId))
const activeCategory = computed(() => props.categories.find(category => category.id === popover.id))
const childrenOf = id => props.categories.filter(category => category.parentId === id)

function open() {
  expandedIds.value = roots.value.map(root => root.id)
  closePopover()
  if (!dialog.value.open) dialog.value.showModal()
}

function close() {
  closePopover()
  dialog.value?.close()
}

function closeOnBackdrop(event) {
  if (event.target === dialog.value) close()
}

function addRoot() {
  const name = rootName.value.trim()
  if (!name) return
  emit('add', name, '')
  rootName.value = ''
}

function toggleExpanded(id) {
  expandedIds.value = expandedIds.value.includes(id)
    ? expandedIds.value.filter(item => item !== id)
    : [...expandedIds.value, id]
}

function closePopover() {
  Object.assign(popover, { id: '', type: '', left: 0, top: 0 })
}

function togglePopover(id, type, event) {
  const shouldClose = popover.id === id && popover.type === type
  if (shouldClose) return closePopover()
  const anchor = event.currentTarget.getBoundingClientRect()
  const modal = dialog.value.getBoundingClientRect()
  Object.assign(popover, {
    id,
    type,
    left: anchor.left - modal.left + anchor.width / 2,
    top: anchor.bottom - modal.top + 10,
  })
  popoverName.value = ''
}

function addNear(category) {
  const name = popoverName.value.trim()
  if (!name) return
  const isChild = Boolean(category.parentId)
  emit('add', name, isChild ? category.parentId : category.id, isChild ? category.id : '')
  if (!isChild && !expandedIds.value.includes(category.id)) expandedIds.value.push(category.id)
  closePopover()
  popoverName.value = ''
}

function rename(category, event) {
  const name = event.currentTarget.innerText.trim()
  if (!name) {
    event.currentTarget.innerText = category.name
    return
  }
  if (name !== category.name) emit('action', category.id, 'rename', name)
}

function confirmDelete(category) {
  emit('action', category.id, 'delete', true)
  closePopover()
}

function setPosition(category, position) {
  emit('action', category.id, 'position', position)
}

function startDrag(category, event) {
  draggedId.value = category.id
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function endDrag() {
  draggedId.value = ''
}

function dropBefore(target, event) {
  event.preventDefault()
  event.stopPropagation()
  if (!draggedId.value || draggedId.value === target.id) return
  emit('action', draggedId.value, 'move', { parentId: target.parentId || '', targetId: target.id })
  draggedId.value = ''
}

function dropInto(root, event) {
  event.preventDefault()
  event.stopPropagation()
  const source = props.categories.find(category => category.id === draggedId.value)
  if (!source || source.id === root.id || childrenOf(source.id).length || props.categoryCount(source.id)) return
  emit('action', source.id, 'move', { parentId: root.id, targetId: '' })
  if (!expandedIds.value.includes(root.id)) expandedIds.value.push(root.id)
  draggedId.value = ''
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialog" class="modal category-modal" @click="closeOnBackdrop">
    <header class="category-dialog-header">
      <span class="category-dialog-icon" aria-hidden="true"><i class="iconfont icon-cat" /></span>
      <span class="category-dialog-title">分类管理</span>
      <button
        class="category-help"
        type="button"
        aria-label="分类管理帮助"
        title="注意：一级分类下如果有卡片或子分类，将无法拖入其他二级分类；上下拖动可排序，向右拖动可移入二级分类。"
      ><i class="iconfont icon-help" aria-hidden="true" /></button>
    </header>

    <div class="category-dialog-body">
      <form class="category-root-form" @submit.prevent="addRoot">
        <input v-model="rootName" maxlength="12" aria-label="新增一级分类" placeholder="输入分类名，回车提交！" />
      </form>

      <div class="category-tree-scroll">
        <ul class="category-tree">
          <li v-for="root in roots" :key="root.id" class="category-item" :class="{ 'has-children': childrenOf(root.id).length }">
            <div
              class="category-item-content"
              draggable="true"
              @dragstart="startDrag(root, $event)"
              @dragend="endDrag"
              @dragover.prevent
              @drop="dropBefore(root, $event)"
            >
              <button
                v-if="childrenOf(root.id).length"
                class="category-tree-toggle"
                type="button"
                :aria-label="expandedIds.includes(root.id) ? '收起分类' : '展开分类'"
                @click="toggleExpanded(root.id)"
              ><i class="iconfont icon-totop" :class="{ expanded: expandedIds.includes(root.id) }" aria-hidden="true" /></button>
              <i v-else class="iconfont icon-drag category-drag-icon" aria-hidden="true" />
              <span
                class="category-name"
                contenteditable="true"
                role="textbox"
                spellcheck="false"
                :aria-label="`重命名${root.name}`"
                :textContent="root.name"
                @keydown.enter.prevent="$event.currentTarget.blur()"
                @blur="rename(root, $event)"
              />
              <span v-if="categoryCount(root.id)" class="category-count">{{ categoryCount(root.id) }}</span>

              <div class="category-actions">
                <span class="category-action-wrap">
                  <button class="category-action success" type="button" aria-label="设置二级 Tabs 位置" @click="togglePopover(root.id, 'position', $event)">
                    <i class="iconfont icon-tab" aria-hidden="true" />
                  </button>
                </span>
                <span class="category-action-wrap">
                  <button class="category-action primary" type="button" aria-label="添加子分类" @click="togglePopover(root.id, 'add', $event)">
                    <i class="iconfont icon-add" aria-hidden="true" />
                  </button>
                </span>
                <span class="category-action-wrap">
                  <button class="category-action danger" type="button" aria-label="删除分类" @click="togglePopover(root.id, 'delete', $event)">
                    <i class="iconfont icon-delete" aria-hidden="true" />
                  </button>
                </span>
              </div>
            </div>

            <ul
              v-show="expandedIds.includes(root.id) || !childrenOf(root.id).length"
              class="category-tree category-children"
              :class="{ empty: !childrenOf(root.id).length }"
              @dragover.prevent
              @drop="dropInto(root, $event)"
            >
              <li v-for="child in childrenOf(root.id)" :key="child.id" class="category-item">
                <div
                  class="category-item-content"
                  draggable="true"
                  @dragstart.stop="startDrag(child, $event)"
                  @dragend="endDrag"
                  @dragover.prevent
                  @drop="dropBefore(child, $event)"
                >
                  <i class="iconfont icon-drag category-drag-icon" aria-hidden="true" />
                  <span
                    class="category-name"
                    contenteditable="true"
                    role="textbox"
                    spellcheck="false"
                    :aria-label="`重命名${child.name}`"
                    :textContent="child.name"
                    @keydown.enter.prevent="$event.currentTarget.blur()"
                    @blur="rename(child, $event)"
                  />
                  <span v-if="categoryCount(child.id)" class="category-count">{{ categoryCount(child.id) }}</span>

                  <div class="category-actions">
                    <span class="category-action-wrap">
                      <button class="category-action primary" type="button" aria-label="追加分类" @click="togglePopover(child.id, 'add', $event)">
                        <i class="iconfont icon-add" aria-hidden="true" />
                      </button>
                    </span>
                    <span class="category-action-wrap">
                      <button class="category-action danger" type="button" aria-label="删除分类" @click="togglePopover(child.id, 'delete', $event)">
                        <i class="iconfont icon-delete" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <template v-if="activeCategory">
      <div
        v-if="popover.type === 'position'"
        class="category-popover position-popover"
        :style="{ left: `${popover.left}px`, top: `${popover.top}px` }"
        @click.stop
      >
        <span>二级Tabs位置：</span>
        <div class="position-options">
          <label v-for="option in [{ value: 'left', label: '左' }, { value: 'right', label: '右' }, { value: 'top', label: '上' }, { value: 'bottom', label: '下' }]" :key="option.value">
            <input type="radio" :checked="activeCategory.tabPosition === option.value" @change="setPosition(activeCategory, option.value)" />{{ option.label }}
          </label>
        </div>
      </div>
      <form
        v-if="popover.type === 'add'"
        class="category-popover add-popover"
        :style="{ left: `${popover.left}px`, top: `${popover.top}px` }"
        @submit.prevent="addNear(activeCategory)"
        @click.stop
      >
        <span>{{ activeCategory.parentId ? '追加分类' : '添加子分类' }}</span>
        <input v-model="popoverName" maxlength="12" aria-label="分类名称" placeholder="输入分类名，回车提交！" />
      </form>
      <div
        v-if="popover.type === 'delete'"
        class="category-popover delete-popover"
        :style="{ left: `${popover.left}px`, top: `${popover.top}px` }"
        @click.stop
      >
        <p>{{ activeCategory.parentId ? '删除分类后，分类中的卡片会移到废纸篓。' : '删除分类后，其子分类将一并删除，分类中的卡片会移到废纸篓。' }}</p>
        <div><button type="button" @click="closePopover">算了</button><button class="confirm-delete" type="button" @click="confirmDelete(activeCategory)">删吧</button></div>
      </div>
    </template>
  </dialog>
</template>
