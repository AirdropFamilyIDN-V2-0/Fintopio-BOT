const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { DateTime } = require("luxon");

class Fintopio {
  constructor() {
    this.baseUrl = process.env.BASE_URL || "https://fintopio-tg.fintopio.com/api";
    this.headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://fintopio-tg.fintopio.com/",
      "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
      "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
    };
  }

  log(msg, color = "white") {
    console.log(msg[color]);
  }

  async waitWithCountdown(seconds) {
    const spinners = ["|", "/", "-", "\\"];
    let i = 0;

    for (let s = seconds; s >= 0; s--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`${spinners[i]} Menunggu ${s} detik untuk melanjutkan ${spinners[i]}`.cyan);
      i = (i + 1) % spinners.length;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log("");
  }

  async auth(userData) {
    const url = `${this.baseUrl}/auth/telegram`;
    const headers = { ...this.headers, Webapp: "true" };

    try {
      const response = await axios.get(`${url}?${userData}`, { headers });
      return response.data.token;
    } catch (error) {
      this.log(`Kesalahan autentikasi`, "red");
      return null;
    }
  }

  async getProfile(token) {
    const url = `${this.baseUrl}/referrals/data`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      Webapp: "false, true",
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Kesalahan mengambil profil`, "red");
      return null;
    }
  }

  async checkInDaily(token) {
    const url = `${this.baseUrl}/daily-checkins`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      await axios.post(url, {}, { headers });
      this.log("Check-in harian berhasil!", "green");
    } catch (error) {
      this.log(`Kesalahan check-in harian`, "red");
    }
  }

  async getFarmingState(token) {
    const url = `${this.baseUrl}/farming/state`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Kesalahan mengambil status farming: ${error.message}`, "red");
      return null;
    }
  }

  async startFarming(token) {
    const url = `${this.baseUrl}/farming/farm`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.post(url, {}, { headers });
      const finishTimestamp = response.data.timings?.finish;

      if (finishTimestamp) {
        const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(DateTime.DATETIME_FULL);
        this.log(`Memulai farming...`, "yellow");
        this.log(`Waktu penyelesaian farming: ${finishTime}`, "green");
      } else {
        this.log("Tidak ada waktu penyelesaian yang tersedia.", "yellow");
      }
    } catch (error) {
      this.log(`Kesalahan memulai farming: ${error.message}`, "red");
    }
  }

  async claimFarming(token) {
    const url = `${this.baseUrl}/farming/claim`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.post(url, {}, { headers });
      if (response.status === 201) {
        this.log("farming berhasil diklaim!", "green");
      }
    } catch (error) {
      this.log(`Kesalahan mengklaim farming: ${error.message}`, "red");
    }
  }

  extractFirstName(userData) {
    try {
      const userPart = userData.match(/user=([^&]*)/)[1];
      const decodedUserPart = decodeURIComponent(userPart);
      const userObj = JSON.parse(decodedUserPart);
      return userObj.first_name || "Tidak Diketahui";
    } catch (error) {
      this.log(`Kesalahan mengekstrak first_name: ${error.message}`, "red");
      return "Tidak Diketahui";
    }
  }

  async getTasks(token) {
    const url = `${this.baseUrl}/hold/tasks`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      const tasks = response.data.tasks || [];
      for (const task of tasks) {
        console.log(`ID Tugas: ${task.id}, Slug: ${task.slug}`);
        await this.startTask(token, task.id);
        await this.claimTask(token, task.id);
      }
      return tasks;
    } catch (error) {
      this.log(`Kesalahan mengambil tugas`, "red");
      return [];
    }
  }

  async startTask(token, taskId) {
    const url = `${this.baseUrl}/hold/tasks/${taskId}/start`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      await axios.post(url, {}, { headers });
      this.log(`Status Tugas ${taskId} berhasil dimulai!`, "green");
      await this.waitWithCountdown(10);
    } catch (error) {
      this.log(`Kesalahan memulai tugas ${taskId}`, "red");
    }
  }

  async claimTask(token, taskId) {
    const url = `${this.baseUrl}/hold/tasks/${taskId}/claim`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await axios.post(url, {}, { headers });
      if (response.status === 201) {
        this.log(`Klaim Tugas ${taskId} berhasil!`, "green");
      } else if (response.status === 400) {
        this.log(`Klaim Tugas ${taskId} gagal: Tugas tidak tersedia`, "red");
      } else {
        this.log(`Klaim Tugas ${taskId} gagal`, "red");
      }
    } catch (error) {
      this.log(`Kesalahan mengklaim tugas ${taskId}`, "red");
    }
  }

  async main() {
    console.log(`
  _____ _       _              _       
 |  ___(_)_ __ | |_ ___  _ __ (_) ___  
 | |_  | | '_ \\| __/ _ \\| '_ \\| |/ _ \\ 
 |  _| | | | | | || (_) | |_) | | (_) |
 |_|   |_|_| |_|\\__\\___/| .__/|_|\\___/ 
                        |_|            
                       `);
    console.log(`Sumber     : https://github.com/Galkurta/Fintopio-BOT
Update oleh: https://t.me/AirdropFamilyIDN`);
    console.log(`Update Clear Task + Claim Task`);
    while (true) {
      const dataFile = path.join(__dirname, "data.txt");
      const data = await fs.readFile(dataFile, "utf8");
      const users = data.split("\n").filter(Boolean);

      for (let i = 0; i < users.length; i++) {
        const userData = users[i];
        const firstName = this.extractFirstName(userData);
        console.log(`${"=".repeat(5)} Akun ${i + 1} | ${firstName.green} ${"=".repeat(5)}`.blue);

        const token = await this.auth(userData);
        if (token) {
          this.log("Login berhasil!", "green");
          const profile = await this.getProfile(token);
          if (profile) {
            const balance = profile.balance;
            this.log(`Saldo: ${balance}`, "green");

            await this.checkInDaily(token);

            const farmingState = await this.getFarmingState(token);

            if (farmingState) {
              if (farmingState.state === "idling") {
                await this.startFarming(token);
              } else if (farmingState.state === "farmed" || farmingState.state === "farming") {
                const finishTimestamp = farmingState.timings?.finish;
                if (finishTimestamp) {
                  const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(DateTime.DATETIME_FULL);
                  this.log(`Waktu penyelesaian farming: ${finishTime}`, "green");

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
              this.log("Tidak ada tugas yang tersedia untuk dikerjakan.", "yellow");
            }
          }
        }
      }
      // Tunggu selama 20 detik sebelum memulai iterasi berikutnya
      this.log("Menunggu selama 20 detik sebelum iterasi berikutnya...", "cyan");
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
