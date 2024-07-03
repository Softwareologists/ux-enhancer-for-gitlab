import { debounce } from 'lodash-es';
import {
    Preference,
    useExtensionStore,
} from '../store';
import { computed } from 'vue';

export function useHighlightMyIssuesMrs() {
    const { getSetting } = useExtensionStore();

    const isHighlightMyIssueEnabled = computed(() => !!getSetting(Preference.ISSUE_HIGHLIGHT_MINE, true));
    const isHighlightMyMrEnabled = computed(() => !!getSetting(Preference.MR_HIGHLIGHT_MINE, true));

    function highlight(username: string) {
        if (!username) {
            return;
        }

        if (isHighlightMyIssueEnabled.value) {
            if (window.location.href.includes('boards')) {
                const cardElements = document.querySelectorAll(`.board-card a[href="/${username}"]`);
                cardElements.forEach((element) => {
                    const parentElement = element.closest('li.board-card') as HTMLElement | null;

                    if (parentElement?.style) {
                        parentElement.style.border = '2px dashed #5943b6';
                    }
                });
            }

            if (window.location.href.includes('issues') && !window.location.href.includes('dashboard')) {
                const avatarElements = document.querySelectorAll(`.issuable-meta a.gl-avatar-link[href$="/${username}"]`);
                avatarElements.forEach((element) => {
                    const parentElement = element.closest('li.issue') as HTMLElement | null;

                    if (parentElement?.style) {
                        parentElement.style.border = '2px dashed #5943b6';
                        parentElement.style.borderRadius = '0.25rem';
                        parentElement.style.margin = '0.5rem';
                    }
                });
            }
        }

        if (isHighlightMyMrEnabled.value && window.location.href.includes('merge_requests') && !window.location.href.includes('dashboard')) {
            const avatarElements = document.querySelectorAll(`.issuable-info-container li:not(.issuable-reviewers) a.author-link[href$="/${username}"]`);
            avatarElements.forEach((element) => {
                const parentElement = element.closest('li.merge-request') as HTMLElement | null;

                if (parentElement?.style) {
                    parentElement.style.border = '2px dashed #5943b6';
                    parentElement.style.borderRadius = '0.25rem';
                    parentElement.style.margin = '0.5rem';
                }
            });
        }
    }

    return {
        highlight: debounce(highlight, 500),
    };
}
