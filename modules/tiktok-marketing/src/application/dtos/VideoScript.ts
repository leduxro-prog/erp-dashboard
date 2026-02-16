/**
 * Video Script DTO
 * Frame-by-frame video script structure for TikTok content.
 */

export type FrameType = 'hook' | 'demo' | 'benefit' | 'economy' | 'cta';

export interface VideoFrame {
    /** Start time in seconds */
    startSec: number;
    /** End time in seconds */
    endSec: number;
    /** Frame type for categorization */
    type: FrameType;
    /** On-screen text overlay */
    copyText: string;
    /** Audio direction / music note */
    audioNote: string;
    /** Visual direction for the videographer */
    visualDescription: string;
}

export interface VideoScript {
    /** Video title / internal name */
    title: string;
    /** Total duration in seconds */
    totalDurationSec: number;
    /** Audio style description */
    audioStyle: string;
    /** Frame-by-frame script */
    frames: VideoFrame[];
    /** Suggested hashtags */
    hashtags: string[];
    /** Product category this script is designed for */
    productCategory: string;
}
