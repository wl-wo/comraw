import type { ApplicationIcon } from '@wl-wo/wo-types';

/**
 * Convert an ApplicationIcon to a usable format for rendering
 */
export function getIconUrl(icon: ApplicationIcon | undefined): {
    type: 'iconify' | 'data-url' | 'url' | 'fallback';
    value: string;
} {
    if (!icon) {
        return { type: 'fallback', value: 'mdi:application' };
    }

    switch (icon.type) {
        case 'iconify':
            return { type: 'iconify', value: icon.data };

        case 'base64': {
            const mimeType = icon.mimeType || 'image/png';
            return { type: 'data-url', value: `data:${mimeType};base64,${icon.data}` };
        }

        case 'url':
            return { type: 'url', value: icon.data };

        case 'path':
            return { type: 'url', value: `file://${icon.data}` };

        default:
            if (icon.fallback) {
                return getIconUrl(icon.fallback);
            }
            return { type: 'fallback', value: 'mdi:application' };
    }
}

/**
 * Create a simple ApplicationIcon from an Iconify name
 */
export function createIconifyIcon(iconName: string): ApplicationIcon {
    return {
        type: 'iconify',
        data: iconName,
    };
}

/**
 * Create a simple ApplicationIcon from a base64-encoded image
 */
export function createBase64Icon(
    base64Data: string,
    mimeType: string = 'image/png'
): ApplicationIcon {
    return {
        type: 'base64',
        data: base64Data,
        mimeType,
    };
}

/**
 * Create a simple ApplicationIcon from a URL
 */
export function createUrlIcon(url: string): ApplicationIcon {
    return {
        type: 'url',
        data: url,
    };
}

/**
 * Create a simple ApplicationIcon from a file path
 */
export function createPathIcon(path: string): ApplicationIcon {
    return {
        type: 'path',
        data: path,
    };
}
