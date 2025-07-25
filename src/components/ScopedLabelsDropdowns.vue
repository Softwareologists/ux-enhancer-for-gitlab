<template>
    <div>
        <template
            v-for="(element, scope) in teleportElements"
            :key="scope"
        >
            <teleport
                v-if="selectedProjectPath && element"
                :to="element"
            >
                <SvgIcon
                    :path="mdiChevronDown"
                    style="margin: -1px; pointer-events: none;"
                />

                <ul
                    :class="{
                        'show': selectedScope === scope,
                    }"
                    class="dropdown-menu"
                    :style="{
                        left: offsetLeft,
                    }"
                    style="width: 240px;"
                >
                    <div class="gl-dropdown-inner">
                        <div class="gl-dropdown-contents">
                            <template
                                v-for="label in getProjectScopedLabels(selectedProjectPath, scope)"
                                :key="label.name"
                            >
                                <li
                                    class="gl-dropdown-item"
                                    style="padding: 8px 16px;"
                                    @click="updateIssueLabel(label.name)"
                                >
                                    <GLabel
                                        :color="label.color"
                                        class="gl-mb-0! gl-mr-0!"
                                        :is-small="false"
                                        :label="label.name"
                                        :text-color="label.text_color"
                                    />
                                </li>
                            </template>
                        </div>
                    </div>
                </ul>
            </teleport>
        </template>
    </div>
</template>

<script
    lang="ts"
    setup
>
    import { mdiChevronDown } from '@mdi/js';
    import { useFetch } from '@vueuse/core';
    import { debounce } from 'lodash-es';
    import {
        computed,
        onBeforeUnmount,
        onMounted,
        type Ref,
        ref,
    } from 'vue';
    import { useExtractProjectPaths } from '../composables/useExtractProjectPaths';
    import { useMitt } from '../composables/useMitt';
    import { MittEventKey } from '../enums';
    import { useExtensionStore } from '../store';
    import GLabel from './GLabel.vue';
    import SvgIcon from './SvgIcon.vue';

    interface Props {
        currentProjectPath: string,
        csrfToken: string,
        iid: number,
    }

    const props = defineProps<Props>();

    const {
        getProjectLabels,
        getProjectScopedLabels,
    } = useExtensionStore();

    const { extract: extractProjectPaths } = useExtractProjectPaths();

    const {
        on,
        off,
    } = useMitt();

    const teleportElements: Ref<Record<string, HTMLElement>> = ref({});
    const selectedScope = ref('');
    const offsetLeft = ref('0');

    const isIssueBoard = computed(() => window.location.href.includes('/-/boards'));
    const isIssuesList = computed(() => {
        const { pathname } = window.location;
        return pathname.includes('/-/issues') && !pathname.match(/\/-\/(?:issues|work_items)\/[0-9]+/);
    });

    const iid = computed(() => {
        if (props.iid) {
            return props.iid;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const queryIid = searchParams.get('issue_iid')
            || searchParams.get('work_item_iid');
        if (queryIid) {
            return parseInt(queryIid, 10);
        }

        const queryPath = searchParams.get('issue_path')
            || searchParams.get('work_item_path');
        const queryPathMatch = queryPath?.match(/\/(?:issues|work_items)\/(\d+)/);
        if (queryPathMatch) {
            return parseInt(queryPathMatch[1], 10);
        }

        const pathMatch = window.location.pathname.match(/\/-\/(?:issues|work_items)\/(\d+)/);
        if (pathMatch) {
            return parseInt(pathMatch[1], 10);
        }

        if (isIssueBoard.value) {
            const activeCard = document.querySelector('li.board-card.is-active, li.board-card.is-focused, li.board-card.gl-active') as HTMLElement | null;
            const iidAttr = activeCard?.getAttribute('data-item-iid')
                || activeCard?.getAttribute('data-issue-iid')
                || activeCard?.getAttribute('data-work-item-iid')
                || activeCard?.getAttribute('data-iid')
                || activeCard?.getAttribute('data-id');
            return parseInt(iidAttr || '0', 10);
        }

        if (isIssuesList.value) {
            const activeRow = document.querySelector('li.issue.\\!gl-bg-feedback-info') as HTMLElement | null;
            const href = activeRow?.querySelector('a[data-testid="issuable-title-link"]')?.getAttribute('href');
            const iid = href?.split('/').pop();
            return parseInt(iid || '0', 10);
        }

        return 0;
    });

    const selectedProjectPath = computed(() => {
        if (props.currentProjectPath) {
            return props.currentProjectPath;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const queryPath = searchParams.get('issue_path')
            || searchParams.get('work_item_path');
        if (queryPath) {
            return queryPath.split('#')[0];
        }

        const pathMatch = window.location.pathname.match(/^(.*)\/-\/(?:issues|work_items)\/[0-9]+/);
        if (pathMatch) {
            return pathMatch[1].substring(1);
        }

        if (isIssueBoard.value) {
            const activeCard = document.querySelector('li.board-card.is-active') as HTMLElement | null;
            const pathAttr = activeCard?.getAttribute('data-item-path')
                || activeCard?.getAttribute('data-issue-path')
                || activeCard?.getAttribute('data-work-item-path');
            return pathAttr?.split('#')?.[0] || '';
        }

        if (isIssuesList.value) {
            const activeRow = document.querySelector('li.issuable-row.is-active, li.issuable-row.is-focused, li.issuable-row.gl-active, li.issue.is-active, li.issue.gl-active') as HTMLElement | null;
            const pathAttr = activeRow?.getAttribute('data-item-path')
                || activeRow?.getAttribute('data-issue-path')
                || activeRow?.getAttribute('data-work-item-path')
                || activeRow?.getAttribute('data-full-path');
            return pathAttr?.split('#')?.[0] || '';
        }

        return '';
    });

    function updateIssueLabel(label: string) {
        if (!iid.value || !selectedProjectPath.value) {
            return;
        }

        const scopePrefix = label.split('::')[0];

        let removeLabel = '';
        const labelsWrapperElement = document.querySelector('div.labels-select-wrapper, section.js-labels.work-item-attributes-item, section[data-testid="work-item-labels"]');

        if (labelsWrapperElement) {
            labelsWrapperElement.querySelectorAll('span.gl-label:not(.gl-label-scoped)')
                .forEach((element) => {
                    let labelName = element.getAttribute('data-qa-label-name') || element.getAttribute('data-testid') || '';

                    if (!labelName) {
                        const prefix = element.querySelector('span.gl-label-text')?.textContent?.trim() || '';
                        const suffix = element.querySelector('span.gl-label-text-scoped')?.textContent?.trim();
                        labelName = suffix ? `${prefix}::${suffix}` : prefix;
                    }

                    if (labelName.includes('::') && labelName.split('::')[0] === scopePrefix && labelName !== label) {
                        removeLabel = labelName;
                    }
                });
        }

        const payload: Record<string, unknown> = { add_labels: [label] };

        if (removeLabel) {
            payload.remove_labels = [removeLabel];
        }

        useFetch(`/api/v4/projects/${encodeURIComponent(selectedProjectPath.value)}/issues/${iid.value}`, {
            headers: { 'X-CSRF-TOKEN': props.csrfToken },
        })
            .put(payload)
            .then(async () => {
                delete teleportElements.value[scopePrefix];
            });
    }

    function onClickLabelHandler(event: Event) {
        event.stopImmediatePropagation();
        event.preventDefault();
        const target = event.target as HTMLElement;

        document.querySelectorAll('div.labels-select-wrapper span.gl-label, section.js-labels.work-item-attributes-item span.gl-label, section[data-testid="work-item-labels"] span.gl-label')
            .forEach((element) => {
                if ((element as HTMLElement).closest('.dropdown-menu')) {
                    return;
                }
                const spanElement = element as HTMLSpanElement;
                spanElement.style.zIndex = 'initial';
            });

        const parentElement = target.closest('span.gl-label') as HTMLSpanElement | null;

        let labelName = parentElement?.getAttribute('data-qa-label-name') || parentElement?.getAttribute('data-testid') || '';

        if (!labelName) {
            const prefix = parentElement?.querySelector('span.gl-label-text')?.textContent?.trim() || '';
            const suffix = parentElement?.querySelector('span.gl-label-text-scoped')?.textContent?.trim();
            labelName = suffix ? `${prefix}::${suffix}` : prefix;
        }

        if (!labelName.includes('::')) {
            return;
        }

        const scope = labelName.split('::')[0] || '';

        if (parentElement) {
            parentElement.style.zIndex = '1';
        }
        selectedScope.value = selectedScope.value === scope ? '' : scope;
        offsetLeft.value = 0 - (parentElement?.offsetLeft || 0) + 'px';
    }

    async function onClickDocumentHandler() {
        await fetchMultipleProjectLabels();

        setTimeout(() => {
            const header =
                document.querySelector('#js-right-sidebar-portal .gl-drawer-header') ||
                document.querySelector('aside.work-item-drawer .gl-drawer-header');

            if (header) {
                deboundedInjectTeleports();
            }
        }, 400);
    }

    function injectTeleports() {
        if (!iid.value || !document.querySelector('div.labels-select-wrapper .shortcut-sidebar-dropdown-toggle, section.js-labels.work-item-attributes-item .shortcut-sidebar-dropdown-toggle, section[data-testid="work-item-labels"] .shortcut-sidebar-dropdown-toggle')) {
            return;
        }

        const labelsWrapperElement = document.querySelector('div.labels-select-wrapper, section.js-labels.work-item-attributes-item, section[data-testid="work-item-labels"]');

        if (!labelsWrapperElement) {
            return;
        }

        const labelElements = labelsWrapperElement.querySelectorAll('span.gl-label:not(.gl-label-scoped)');

        labelElements.forEach((element) => {
            let labelName = element.getAttribute('data-qa-label-name') || element.getAttribute('data-testid') || '';
            if (!labelName) {
                const prefix = element.querySelector('span.gl-label-text')?.textContent?.trim() || '';
                const suffix = element.querySelector('span.gl-label-text-scoped')?.textContent?.trim();
                labelName = suffix ? `${prefix}::${suffix}` : prefix;
            }

            if (!labelName.includes('::')) {
                return;
            }

            const scopePrefix = labelName.split('::')[0];

            if (!scopePrefix) {
                return;
            }

            element.classList.add('gl-overflow-visible');

            const scopeSpanElement = element.querySelector('span.gl-label-text');
            scopeSpanElement?.setAttribute('style', 'border-radius: 16px 0 0 16px;');

            const teleportElement = element.querySelector('span.gl-label-text');
            if (teleportElement) {
                const existingElement = teleportElements.value[scopePrefix];

                if (existingElement !== teleportElement) {
                    existingElement?.removeEventListener('click', onClickLabelHandler);

                    teleportElements.value[scopePrefix] = teleportElement as HTMLElement;
                    teleportElement.addEventListener('click', onClickLabelHandler);
                }
            }
        });
    }

    async function fetchMultipleProjectLabels() {
        const paths = extractProjectPaths();
        const promises = paths.map((path) => getProjectLabels(path));

        await Promise.all(promises);
    }

    const deboundedInjectTeleports = debounce(injectTeleports, 400);
    onMounted(async () => {
        if (!props.currentProjectPath) {
            setTimeout(() => {
                fetchMultipleProjectLabels();
            }, 600);
        } else {
            await getProjectLabels(props.currentProjectPath);
        }

        if (isIssueBoard.value || isIssuesList.value) {
            document.body.addEventListener('mouseup', onClickDocumentHandler);
        } else {
            on(MittEventKey.BROWSER_REQUEST_COMPLETED, deboundedInjectTeleports);
        }
    });

    onBeforeUnmount(() => {
        off(MittEventKey.BROWSER_REQUEST_COMPLETED, deboundedInjectTeleports);

        document.body.removeEventListener('mouseup', onClickDocumentHandler);

        Object.values(teleportElements.value)
            .forEach((element) => {
                element.removeEventListener('click', onClickLabelHandler);
            });
    });
</script>

<style
    lang="scss"
    scoped
>
    li.gl-dropdown-item:hover {
        cursor: pointer;
        background-color: #ececef;
    }
</style>
