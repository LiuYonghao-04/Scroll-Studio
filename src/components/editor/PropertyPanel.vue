<script setup lang="ts">
import { computed } from 'vue'
import {
  SlidersHorizontal,
  Sparkles,
  MousePointer2,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
} from '@lucide/vue'
import { useEditorStore } from '../../stores/editor'
import type { NodeStyle } from '../../types/editor'
import MotionPanel from './MotionPanel.vue'
import { resolveStyle } from '../../core/responsive'
const emit = defineEmits<{ media: [] }>()
const store = useEditorStore()
const node = computed(() => store.selected)
const assetName = computed(() => {
  const selected = node.value
  return selected
    ? (store.document.assets.find((asset) => `asset:${asset.id}` === selected.src)?.name ??
        '未命名图片')
    : ''
})
const currentStyle = computed(() =>
  node.value ? resolveStyle(node.value, store.device) : undefined,
)
const overrides = computed(() =>
  node.value && store.device !== 'desktop'
    ? Object.keys(node.value.responsive[store.device]).length
    : 0,
)
function openMedia() {
  store.libraryTab = 'media'
  emit('media')
}

const numericStyles: {
  key: 'fontSize' | 'padding' | 'margin' | 'radius' | 'gap'
  label: string
  min: number
}[] = [
  { key: 'fontSize', label: '字号', min: 8 },
  { key: 'padding', label: '内边距', min: 0 },
  { key: 'margin', label: '外边距', min: 0 },
  { key: 'radius', label: '圆角', min: 0 },
  { key: 'gap', label: '组件间距', min: 0 },
]
function value(event: Event) {
  return (event.target as HTMLInputElement).value
}
function textInput(event: Event, key: 'content' | 'name') {
  if (node.value)
    store.update(
      node.value.id,
      { [key]: value(event) },
      undefined,
      undefined,
      `${node.value.id}:${key}`,
    )
}
function style(patch: Partial<NodeStyle>) {
  if (node.value) store.updateStyle(node.value.id, patch)
}
function numeric(event: Event, key: keyof NodeStyle, min: number) {
  const n = Number(value(event))
  if (Number.isFinite(n)) style({ [key]: Math.max(min, Math.min(160, n)) })
}
function dimension(
  event: Event,
  key: 'width' | 'height' | 'maxWidth' | 'minHeight' | 'borderWidth' | 'fontWeight' | 'lineHeight',
  min: number,
  max: number,
) {
  const n = Number(value(event))
  if (Number.isFinite(n)) style({ [key]: Math.max(min, Math.min(max, n)) })
}
</script>
<template>
  <aside class="properties panel">
    <div class="panel-tabs">
      <button
        :class="{ active: store.inspectorTab === 'style' }"
        @click="store.inspectorTab = 'style'"
      >
        <SlidersHorizontal :size="14" />属性</button
      ><button
        :class="{ active: store.inspectorTab === 'motion' }"
        @click="store.inspectorTab = 'motion'"
      >
        <Sparkles :size="14" />动画<span class="beta-tag">BETA</span>
      </button>
    </div>
    <div v-if="!node" class="property-empty">
      <MousePointer2 :size="30" :stroke-width="1.2" />
      <h3>选中，开始设计。</h3>
      <p>点击画布中的任意组件，<br />在这里调整它的每个细节。</p>
    </div>
    <template v-else>
      <div class="property-title">
        <span>{{ node.name }}</span
        ><span class="mono">{{ node.kind }}</span>
      </div>
      <div class="property-actions">
        <button aria-label="上移组件" title="上移" @click="store.reorder(node.id, -1)">
          <ArrowUp :size="15" /></button
        ><button aria-label="下移组件" title="下移" @click="store.reorder(node.id, 1)">
          <ArrowDown :size="15" /></button
        ><button aria-label="复制组件" title="复制" @click="store.duplicate(node.id)">
          <Copy :size="15" /></button
        ><button class="danger" aria-label="删除组件" title="删除" @click="store.remove(node.id)">
          <Trash2 :size="15" />
        </button>
      </div>
      <div v-if="store.inspectorTab === 'style' && currentStyle" class="property-fields">
        <div class="breakpoint-editor">
          <span>当前样式断点</span>
          <div class="breakpoint-switch" aria-label="样式断点">
            <button
              v-for="(label, key) in { desktop: '桌面', tablet: '平板', mobile: '手机' }"
              :key="key"
              :aria-pressed="store.device === key"
              @click="store.device = key"
            >
              {{ label }}
            </button>
          </div>
          <p>
            {{
              store.device === 'desktop'
                ? '桌面为基础样式。文字内容与图片在所有尺寸共享。'
                : `当前 ${overrides} 项独立样式；其余继承${store.device === 'mobile' ? '平板，再继承桌面' : '桌面'}。`
            }}
          </p>
          <button
            v-if="store.device !== 'desktop'"
            class="text-button"
            :disabled="!overrides"
            @click="store.resetStyle(node.id)"
          >
            重置此断点，恢复继承
          </button>
        </div>
        <label>图层名称<input :value="node.name" @input="textInput($event, 'name')" /></label>
        <label v-if="node.kind !== 'section'"
          >{{ node.kind === 'image' ? '图片描述（alt）' : '内容'
          }}<textarea
            :value="node.content"
            rows="3"
            @input="textInput($event, 'content')"
          ></textarea>
        </label>
        <label v-if="node.kind === 'image' && !node.src.startsWith('asset:')"
          >图片地址<input
            :value="node.src"
            placeholder="https://… 或 /images/…"
            @change="store.update(node.id, { src: value($event) })"
          /><small>支持 HTTP(S) 或本站路径。</small></label
        >
        <template v-if="node.kind === 'image' && node.src.startsWith('asset:')">
          <p class="panel-help">本地图片 · {{ assetName }}</p>
          <button
            class="text-button"
            @click="store.update(node.id, { src: '/images/landscape.svg' })"
          >
            改用网络图片
          </button>
        </template>
        <button v-if="node.kind === 'image'" class="btn small" @click="openMedia">
          选择或上传本地图片
        </button>
        <label v-if="node.kind === 'button'"
          >链接地址<input
            :value="node.href"
            @change="store.update(node.id, { href: value($event) })"
        /></label>
        <div class="field-divider">外观与排版</div>
        <label
          >字体<select
            :value="currentStyle.fontFamily"
            @change="style({ fontFamily: value($event) as NodeStyle['fontFamily'] })"
          >
            <option value="sans">现代无衬线 / Sans</option>
            <option value="serif">经典衬线 / Serif</option>
            <option value="mono">等宽字体 / Mono</option>
          </select></label
        >
        <div class="field-pair">
          <label
            >文字颜色
            <div class="color-field">
              <input
                type="color"
                :value="currentStyle.color"
                @input="style({ color: value($event) })"
              /><span>{{ currentStyle.color }}</span>
            </div></label
          ><label
            >背景颜色
            <div class="color-field">
              <input
                type="color"
                :value="
                  currentStyle.background === 'transparent' ? '#ffffff' : currentStyle.background
                "
                @input="style({ background: value($event) })"
              /><span>{{
                currentStyle.background === 'transparent' ? '透明' : currentStyle.background
              }}</span>
            </div></label
          >
        </div>
        <button class="text-button" @click="style({ background: 'transparent' })">
          清除背景色
        </button>
        <label
          >对齐方式<select
            :value="currentStyle.align"
            @change="style({ align: value($event) as NodeStyle['align'] })"
          >
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select></label
        >
        <label v-if="node.kind === 'section'"
          >容器布局<select
            :value="currentStyle.layout"
            @change="style({ layout: value($event) as NodeStyle['layout'] })"
          >
            <option value="column">纵向排列 ↓</option>
            <option value="row">横向排列 →</option>
          </select></label
        >
        <div class="field-pair">
          <template v-for="field in numericStyles" :key="field.key"
            ><label v-if="field.key !== 'gap' || node.kind === 'section'"
              >{{ field.label }} · px<input
                type="number"
                :min="field.min"
                max="160"
                :value="currentStyle[field.key]"
                @change="numeric($event, field.key, field.min)" /></label
          ></template>
        </div>
        <div class="field-pair">
          <label
            >字重<input
              type="number"
              min="100"
              max="900"
              step="100"
              :value="currentStyle.fontWeight"
              @change="dimension($event, 'fontWeight', 100, 900)"
          /></label>
          <label
            >行高<input
              type="number"
              min="1"
              max="3"
              step="0.05"
              :value="currentStyle.lineHeight"
              @change="dimension($event, 'lineHeight', 1, 3)"
          /></label>
        </div>
        <div class="field-divider">尺寸与边框</div>
        <div class="field-pair">
          <label
            >宽度（0 为自动）<input
              type="number"
              min="0"
              :max="currentStyle.widthUnit === '%' ? 100 : 2400"
              :value="currentStyle.width"
              @change="dimension($event, 'width', 0, currentStyle.widthUnit === '%' ? 100 : 2400)"
          /></label>
          <label
            >宽度单位<select
              :value="currentStyle.widthUnit"
              @change="style({ widthUnit: value($event) as NodeStyle['widthUnit'], width: 0 })"
            >
              <option value="px">像素 px</option>
              <option value="%">百分比 %</option>
            </select></label
          >
          <label
            >最大宽度 · px<input
              type="number"
              min="0"
              max="2400"
              :value="currentStyle.maxWidth"
              @change="dimension($event, 'maxWidth', 0, 2400)"
          /></label>
          <label
            >高度 · px<input
              type="number"
              min="0"
              max="2400"
              :value="currentStyle.height"
              @change="dimension($event, 'height', 0, 2400)"
          /></label>
          <label
            >最小高度 · px<input
              type="number"
              min="0"
              max="2400"
              :value="currentStyle.minHeight"
              @change="dimension($event, 'minHeight', 0, 2400)"
          /></label>
          <label
            >边框宽度 · px<input
              type="number"
              min="0"
              max="20"
              :value="currentStyle.borderWidth"
              @change="dimension($event, 'borderWidth', 0, 20)"
          /></label>
        </div>
        <small
          >最大宽度和高度为 0 时不设限制；固定高度可能裁切图片或溢出文字，请在预览中检查。</small
        >
        <label
          >边框颜色<input
            type="color"
            :value="currentStyle.borderColor"
            @input="style({ borderColor: value($event) })"
        /></label>
        <label
          >边框样式<select
            :value="currentStyle.borderStyle"
            @change="style({ borderStyle: value($event) as NodeStyle['borderStyle'] })"
          >
            <option value="solid">实线</option>
            <option value="dashed">虚线</option>
            <option value="dotted">点线</option>
          </select></label
        >
        <label v-if="node.kind === 'image'"
          >图片填充<select
            :value="currentStyle.objectFit"
            @change="style({ objectFit: value($event) as NodeStyle['objectFit'] })"
          >
            <option value="cover">裁切铺满</option>
            <option value="contain">完整显示</option>
          </select></label
        >
        <template v-if="node.kind === 'section'">
          <label
            >主轴分布<select
              :value="currentStyle.justify"
              @change="style({ justify: value($event) as NodeStyle['justify'] })"
            >
              <option value="flex-start">起点</option>
              <option value="center">居中</option>
              <option value="flex-end">终点</option>
              <option value="space-between">两端分布</option>
            </select></label
          >
          <label class="toggle-field"
            >允许换行<input
              type="checkbox"
              :checked="currentStyle.wrap"
              @change="style({ wrap: ($event.target as HTMLInputElement).checked })"
          /></label>
        </template>
      </div>
      <MotionPanel v-else />
    </template>
  </aside>
</template>
