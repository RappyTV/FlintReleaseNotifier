import { config as loadEnv } from "dotenv";

loadEnv();

export const config = {
    cron: process.env.CRON_INTERVAL || '0 * * * *',
    labymodVersion: process.env.LABYMOD_VERSION || '4.2.47',
    watchedMods: (process.env.WATCHED_MODS || '').split(','),
    webhook: {
        content: process.env.DISCORD_CONTENT || '',
        url: process.env.DISCORD_WEBHOOK || ''
    }
}