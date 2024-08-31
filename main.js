const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const { DateTime } = require('luxon');

const api = "https://fintopio-tg.fintopio.com/api";
const headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://fintopio-tg.fintopio.com/",
    "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128", "Microsoft Edge WebView2";v="128"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "Windows",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    "Webapp": "true"
};

class Fintopio {
    constructor() {
        this.baseUrl = process.env.BASE_URL || api;
        this.headers = headers;
    }

    log(msg) {
        console.log(`\x1b[36m${msg}\x1b[0m`);
    }

    async waitWithCountdown(seconds) {
        const spinners = ["|", "/", "-", "\\"];
        let i = 0;

        for (let s = seconds; s >= 0; s--) {
            readline.cursorTo(process.stdout, 0);
            const spinner = spinners[i];
            const countdownMessage = `\x1b[33m${spinner} Menunggu ${s} detik untuk melanjutkan ${spinner}\x1b[0m`;
            process.stdout.write(countdownMessage + '\r');
            i = (i + 1) % spinners.length;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log("");
    }

    async auth(userData) {
        const url = `${this.baseUrl}/auth/telegram`;
        try {
            const response = await axios.get(`${url}?${userData}`, { headers: this.headers });
            return response.data.token;
        } catch (error) {
            this.log("\x1b[31mKesalahan autentikasi\x1b[0m");
            return null;
        }
    }

    async getProfile(token) {
        const url = `${this.baseUrl}/referrals/data`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}` };
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            this.log("\x1b[31mKesalahan mengambil profil\x1b[0m");
            return null;
        }
    }

    async diamondState(token) {
        try {
            const response = await axios.get(`${api}/clicker/diamond/state`, { headers: { ...this.headers, Authorization: `Bearer ${token}` } });
            const data = response.data;
            if (data.state === 'available') {
                await this.nuke(token, data.diamondNumber, data.settings.totalReward);
            } else {
                this.log(data.state === 'unavailable' ? '\x1b[33mAsteroid belum tersedia!\x1b[0m' : '\x1b[33mAsteroid telah dihancurkan! Menunggu putaran berikutnya..\x1b[0m');
            }
        } catch (err) {
            this.log('\x1b[31mKesalahan\x1b[0m');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    async nuke(token, id, reward) {
        try {
            const response = await axios.post(`${api}/clicker/diamond/complete`, { diamondNumber: id }, { headers: { ...this.headers, Authorization: `Bearer ${token}` } });
            if (response.status === 200) {
                this.log('\x1b[32mAsteroid telah dihancurkan!\x1b[0m');
                this.log('Reward: ' + reward);
            } else {
                this.log('\x1b[31mGagal mengklaim\x1b[0m');
            }
        } catch (err) {
            this.log('\x1b[31mGagal memulai\x1b[0m');
        }
    }

    async getUsername(token) {
        const url = `${api}/fast/init`;
        const headersWithAuth = { ...this.headers, Authorization: `Bearer ${token}` };
        try {
            const response = await axios.get(url, { headers: headersWithAuth });
            const username = response.data.profile.telegramUsername;
            return username;
        } catch (error) {
            console.error('\x1b[31mKesalahan mengambil username:\x1b[0m', error.message);
            return null;
        }
    }

    async checkInDaily(token) {
        const url = `${this.baseUrl}/daily-checkins`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        try {
            await axios.post(url, {}, { headers });
            this.log("\x1b[32mCheck-in harian berhasil!\x1b[0m");
        } catch (error) {
            this.log("\x1b[31mKesalahan check-in harian\x1b[0m");
        }
    }

    async getFarmingState(token) {
        const url = `${this.baseUrl}/farming/state`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}` };
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            this.log(`\x1b[31mKesalahan mengambil status farming: ${error.message}\x1b[0m`);
            return null;
        }
    }

    async startFarming(token) {
        const url = `${this.baseUrl}/farming/farm`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        try {
            const response = await axios.post(url, {}, { headers });
            const finishTimestamp = response.data.timings?.finish;
            if (finishTimestamp) {
                const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(DateTime.DATETIME_FULL);
                this.log("\x1b[32mMemulai farming...\x1b[0m");
                this.log(`Waktu penyelesaian farming: ${finishTime}`);
            } else {
                this.log("\x1b[33mTidak ada waktu penyelesaian yang tersedia.\x1b[0m");
            }
        } catch (error) {
            this.log(`\x1b[31mKesalahan memulai farming: ${error.message}\x1b[0m`);
        }
    }

    async claimFarming(token) {
        const url = `${this.baseUrl}/farming/claim`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        try {
            const response = await axios.post(url, {}, { headers });
            if (response.status === 201) {
                this.log("\x1b[32mFarming berhasil diklaim!\x1b[0m");
            }
        } catch (error) {
            this.log(`\x1b[31mKesalahan mengklaim farming: ${error.message}\x1b[0m`);
        }
    }

    async getTasks(token) {
        const url = `${this.baseUrl}/hold/tasks`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}` };
        try {
            const response = await axios.get(url, { headers });
            const tasks = response.data.tasks || [];
            for (const task of tasks) {
                console.log(`\x1b[36mID Tugas: ${task.id}, Slug: ${task.slug}\x1b[0m`);
                await this.startTask(token, task.id);
                await this.claimTask(token, task.id);
            }
            return tasks;
        } catch (error) {
            this.log("\x1b[31mKesalahan mengambil tugas\x1b[0m");
            return [];
        }
    }

    async startTask(token, taskId) {
        const url = `${this.baseUrl}/hold/tasks/${taskId}/start`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        try {
            await axios.post(url, {}, { headers });
            this.log(`\x1b[32mStatus Tugas ${taskId} berhasil dimulai!\x1b[0m`);
            await this.waitWithCountdown(10);
        } catch (error) {
            this.log(`\x1b[31mKesalahan memulai tugas ${taskId}\x1b[0m`);
        }
    }

    async claimTask(token, taskId) {
        const url = `${this.baseUrl}/hold/tasks/${taskId}/claim`;
        const headers = { ...this.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        try {
            const response = await axios.post(url, {}, { headers });
            if (response.status === 201) {
                this.log(`\x1b[32mKlaim Tugas ${taskId} berhasil!\x1b[0m`);
            } else if (response.status === 400) {
                this.log(`\x1b[31mKlaim Tugas ${taskId} gagal: Tugas tidak tersedia\x1b[0m`);
            } else {
                this.log(`\x1b[31mKlaim Tugas ${taskId} gagal\x1b[0m`);
            }
        } catch (error) {
            this.log(`\x1b[31mKesalahan mengklaim tugas ${taskId}\x1b[0m`);
        }
    }

    async main() {
        console.log(`
  _____ _       _              _       
 |  ___(_)_ __ | |_ ___  _ __ (_) ___  
 | |_  | | '_ \\| __/ _ \\| '_ \\| |/ _ \\ 
 |  _| | | | | | || (_) | |_) | | (_) |
 |_|   |_|_| |_|\\__\\___/| .__/|_|\\___/ V1.2
                        |_|            
                       `);
        console.log(`\x1b[36mBase Sc      : https://github.com/Galkurta/Fintopio-BOT\x1b[0m`);
        console.log(`\x1b[36mSc Asteroid  : t.me/fakinsit\x1b[0m`);
        console.log(`\x1b[36mUpdate by    : https://t.me/AirdropFamilyIDN\x1b[0m`);
        console.log(`\x1b[36mFeature      : Checkin daily + Clear Task + Claim Task + Tap2 Asteroid\x1b[0m`);

        await this.waitWithCountdown(5);

        while (true) {
            const dataFile = path.join(__dirname, "data.txt");
            const data = await fs.promises.readFile(dataFile, "utf8");
            const users = data.trim().split("\n").filter(Boolean);

            for (const userData of users) {
                const token = await this.auth(userData);
                if (token) {
                    this.log("\x1b[32mLogin berhasil!\x1b[0m");
                    const profile = await this.getProfile(token);
                    if (profile) {
                        const username = await this.getUsername(token);
                        if (username) {
                            console.log(`\x1b[36mUsername: ${username}\x1b[0m`);
                        }

                        const balance = profile.balance;
                        this.log(`Saldo: ${balance}`);

                        await this.diamondState(token);
                        await this.checkInDaily(token);

                        const farmingState = await this.getFarmingState(token);

                        if (farmingState) {
                            if (farmingState.state === "idling") {
                                await this.startFarming(token);
                            } else if (farmingState.state === "farmed" || farmingState.state === "farming") {
                                const finishTimestamp = farmingState.timings?.finish;
                                if (finishTimestamp) {
                                    const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(DateTime.DATETIME_FULL);
                                    this.log(`Waktu penyelesaian farming: ${finishTime}`);

                                    const currentTime = DateTime.now().toMillis();
                                    if (currentTime > finishTimestamp) {
                                        await this.claimFarming(token);
                                        await this.startFarming(token);
                                    }
                                }
                            }
                        }

                        const tasks = await this.getTasks(token);
                        if (tasks.length === 0) {
                            this.log("\x1b[33mTidak ada tugas yang tersedia untuk dikerjakan.\x1b[0m");
                        }
                    }
                }

                console.log("");
                console.log("===================================");
                console.log("");
            }
            // tambahkan delay disini
            this.log("\x1b[33mMenunggu selama 20 detik sebelum iterasi berikutnya...\x1b[0m");
            await this.waitWithCountdown(20);
        }
    }
}

if (require.main === module) {
    const fintopio = new Fintopio();
    fintopio.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
