import { useFetch } from '@vueuse/core';
import { debounce } from 'lodash-es';
import { computed } from 'vue';
import {
    Preference,
    useExtensionStore,
} from '../store';
import { useExtractProjectPaths } from './useExtractProjectPaths';

async function fetchProject(path: string | number) {
    const { data } = await useFetch(`/api/v4/projects/${encodeURIComponent(path)}?is_custom=1`)
        .json();

    return data?.value || null;
}

export function useRenderProjectAvatarIssues() {
    const { getSetting } = useExtensionStore();
    const { extract: extractProjectPaths } = useExtractProjectPaths();

    const projectAvatars = {};

    const isInjectAvatarTodoEnabled = computed(() => !!getSetting(Preference.TODO_RENDER_PROJECT_LOGOS, true));
    const isInjectAvatarIssueEnabled = computed(() => !!getSetting(Preference.ISSUE_RENDER_PROJECT_LOGO, true));
    const isInjectAvatarMergeRequestEnabled = computed(() => !!getSetting(Preference.MR_RENDER_PROJECT_LOGO, true));

    function injectAvatar(projectPath: string) {
        const avatarUrl = projectAvatars[projectPath];
        if (!avatarUrl) {
            return;
        }

        if (isInjectAvatarTodoEnabled.value && window.location.href.includes('todos')) {
            const targetElements = document.querySelectorAll(`ul.todos-list a.todo-target-link[href*="${projectPath}"]`);
            targetElements.forEach((targetElement) => {
                const parentElement = targetElement.closest('li')?.children?.[0] || null;
                if (parentElement && !parentElement.children?.[0].classList.contains('chrome-gitlab-enhancer__project-avatar')) {
                    let injectElement: HTMLElement;
                    if (!avatarUrl.includes('http')) {
                        injectElement = document.createElement('div');
                        injectElement.className = 'gl-avatar gl-avatar-identicon gl-avatar-s24 gl-avatar-identicon-bg6';
                        injectElement.textContent = avatarUrl;
                    } else {
                        injectElement = document.createElement('img');
                        injectElement.setAttribute('src', avatarUrl);
                        injectElement.setAttribute('style', 'width: 24px;');
                    }

                    injectElement.classList.add('gl-mr-4', 'chrome-gitlab-enhancer__project-avatar');
                    injectElement.style.alignItems = 'center';

                    parentElement.prepend(injectElement);
                    parentElement.style.alignItems = 'center';
                }
            });
        }

        if (isInjectAvatarIssueEnabled.value) {
            if (window.location.href.includes('issues')) {
                const targetElements = document.querySelectorAll(`li.issue a.issue-title-text[href*="${projectPath}"]`);
                targetElements.forEach((targetElement) => {
                    const parentElement = targetElement?.parentElement?.parentElement?.parentElement || null;
                    if (parentElement && !parentElement.children?.[0].classList.contains('chrome-gitlab-enhancer__project-avatar')) {
                        let injectElement: HTMLElement;
                        if (!avatarUrl.includes('http')) {
                            injectElement = document.createElement('div');
                            injectElement.className = 'gl-avatar gl-avatar-identicon gl-avatar-s24 gl-avatar-identicon-bg6';
                            injectElement.textContent = avatarUrl;
                        } else {
                            injectElement = document.createElement('img');
                            injectElement.setAttribute('src', avatarUrl);
                            injectElement.setAttribute('style', 'width: 24px;');
                        }

                        injectElement.classList.add('gl-mr-5', 'chrome-gitlab-enhancer__project-avatar');

                        parentElement.prepend(injectElement);
                        parentElement.style.alignItems = 'center';
                    }
                });
            }

            if (window.location.href.includes('boards') && avatarUrl.includes('http')) {
                const targetElements = document.querySelectorAll(`li.board-card span[title="${projectPath}"]`);
                targetElements.forEach((targetElement) => {
                    if (targetElement.parentElement && targetElement.previousElementSibling) {
                        const imgElement = document.createElement('img');
                        imgElement.setAttribute('src', avatarUrl);
                        imgElement.setAttribute('style', 'width: 20px;');
                        imgElement.classList.add('chrome-gitlab-enhancer__project-avatar');

                        targetElement.parentElement.replaceChild(imgElement, targetElement.previousElementSibling);
                        targetElement.parentElement.style.display = 'flex';
                        targetElement.parentElement.style.alignItems = 'center';
                    }
                });
            }
        }

        if (isInjectAvatarMergeRequestEnabled.value && (window.location.href.includes('merge_requests') && (window.location.href.includes('groups') || window.location.href.includes('dashboard')))) {
            const targetElements = document.querySelectorAll(`.issuable-list .merge-request-title-text a[href*="${projectPath}"]`);
            targetElements.forEach((targetElement) => {
                const parentElement = targetElement?.closest('li') || null;

                if (parentElement && !parentElement.children?.[0].classList.contains('chrome-gitlab-enhancer__project-avatar')) {
                    let injectElement: HTMLElement;
                    if (!avatarUrl.includes('http')) {
                        injectElement = document.createElement('div');
                        injectElement.className = 'gl-avatar gl-avatar-identicon gl-avatar-s24 gl-avatar-identicon-bg6';
                        injectElement.textContent = avatarUrl;
                    } else {
                        injectElement = document.createElement('img');
                        injectElement.setAttribute('src', avatarUrl);
                        injectElement.setAttribute('style', 'width: 24px;');
                    }

                    injectElement.classList.add('gl-mr-4', 'chrome-gitlab-enhancer__project-avatar');

                    parentElement.prepend(injectElement);
                    parentElement.style.display = 'flex';
                    parentElement.style.alignItems = 'center';
                }
            });
        }
    }

    function injectAvatars() {
        const paths = extractProjectPaths();
        paths.forEach((path) => {
            if (!projectAvatars[path]) {
                fetchProject(path)
                    .then((data) => {
                        projectAvatars[path] = data?.avatar_url || data?.name?.charAt(0) || null;

                        injectAvatar(path);
                    });
            } else {
                injectAvatar(path);
            }
        });
    }

    return {
        render: debounce(injectAvatars, 500),
    };
}
