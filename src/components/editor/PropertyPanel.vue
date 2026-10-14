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
const store = useEditorStore()
const node = computed(() => store.selected)

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
  if (node.value) store.update(node.value.id, {}, patch)
}
function numeric(event: Event, key: keyof NodeStyle, min: number) {
  const n = Number(value(event))
  if (Number.isFinite(n)) style({ [key]: Math.max(min, Math.min(160, n)) })
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
      <div v-if="store.inspectorTab === 'style'" class="property-fields">
        <label>图层名称<input :value="node.name" @input="textInput($event, 'name')" /></label>
        <label v-if="node.kind !== 'section'"
          >{{ node.kind === 'image' ? '图片描述（alt）' : '内容'
          }}<textarea
            :value="node.content"
            rows="3"
            @input="textInput($event, 'content')"
          ></textarea>
        </label>
        <label v-if="node.kind === 'image'"
          >图片地址<input
            :value="node.src"
            placeholder="https://… 或 /images/…"
            @change="store.update(node.id, { src: value($event) })"
          /><small>支持 HTTP(S) 或本站路径。</small></label
        >
        <label v-if="node.kind === 'button'"
          >链接地址<input
            :value="node.href"
            @change="store.update(node.id, { href: value($event) })"
        /></label>
        <div class="field-divider">外观与排版</div>
        <label
          >字体<select
            :value="node.style.fontFamily"
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
                :value="node.style.color"
                @input="style({ color: value($event) })"
              /><span>{{ node.style.color }}</span>
            </div></label
          ><label
            >背景颜色
            <div class="color-field">
              <input
                type="color"
                :value="node.style.background === 'transparent' ? '#ffffff' : node.style.background"
                @input="style({ background: value($event) })"
              /><span>{{
                node.style.background === 'transparent' ? '透明' : node.style.background
              }}</span>
            </div></label
          >
        </div>
        <button class="text-button" @click="style({ background: 'transparent' })">
          清除背景色
        </button>
        <label
          >对齐方式<select
            :value="node.style.align"
            @change="style({ align: value($event) as NodeStyle['align'] })"
          >
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select></label
        >
        <label v-if="node.kind === 'section'"
          >容器布局<select
            :value="node.style.layout"
            @change="style({ layout: value($event) as NodeStyle['layout'] })"
          >
            <option value="column">纵向排列 ↓</option>
            <option value="row">横向排列 →（手机端自动堆叠）</option>
          </select></label
        >
        <div class="field-pair">
          <template v-for="field in numericStyles" :key="field.key"
            ><label v-if="field.key !== 'gap' || node.kind === 'section'"
              >{{ field.label }} · px<input
                type="number"
                :min="field.min"
                max="160"
                :value="node.style[field.key]"
                @change="numeric($event, field.key, field.min)" /></label
          ></template>
        </div>
      </div>
      <MotionPanel v-else />
    </template>
  </aside>
</template>
