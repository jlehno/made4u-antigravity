import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to determine if a color is light or dark
export function isColorLight(hexColor: string) {
    const color = hexColor.charAt(0) === '#' ? hexColor.substring(1, 7) : hexColor;
    if (color.length !== 6) {
      // Return a default for invalid hex codes
      return true;
    }
    const r = parseInt(color.substring(0, 2), 16); // hexToR
    const g = parseInt(color.substring(2, 4), 16); // hexToG
    const b = parseInt(color.substring(4, 6), 16); // hexToB
    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.179;
}
