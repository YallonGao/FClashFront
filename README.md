# FClashFront

FClash 的账号控制台。登录后可以看到所有机场订阅，并且每个订阅都带着自己的官网、购买时注册的机场账号、到期时间和流量。

## 功能

- **登录 / 退出**：JWT 登录，access token 过期自动用 refresh token 续期；退出即清除本地会话
- **订阅台账**：机场名称、订阅链接、官网、机场账号与密码（可显示 / 复制）、到期时间、已用与总流量、备注、启用状态
- **状态提示**：已过期、7 天内到期、已停用，一眼能看出哪条要换
- **设备管理**：列出所有登录过的客户端，可远程注销（该设备的 token 立即失效）

## 技术栈

Vue 3 + Vite + TypeScript + Naive UI。没有引入状态管理库，会话放在一个 `ref` 里，够用且好读。

## 开发

```bash
npm install
npm run dev        # http://localhost:5180，/api 代理到 127.0.0.1:8780
```

后端在本地跑起来即可（见 FClashBack 仓库）。登录页填 `http://127.0.0.1:8780`。

## 构建

```bash
npm run build      # 产物在 dist/
npm run typecheck  # 可选，vue-tsc 全量类型检查
```

`vite.config.ts` 里 `base: './'`，所以同一份产物放在域名根目录、子路径、或被后端接管都能用。

## 部署

推荐和后端同源，省掉 CORS 和一张证书：

```bash
npm run build
scp -r dist/* server:/opt/fclash-back/frontend/
```

FClashBack 启动时检测到 `frontend/index.html` 就会托管它，访问 `https://你的域名/` 直接进控制台。也可以把 `dist/` 丢给任意静态服务器，登录页填后端地址即可。

## 说明

- 登录页默认填当前站点地址——同源部署时不用手输。
- 会话存在 `localStorage`，token 与浏览器绑定；公共电脑上用完请退出。
- 订阅数据来自 `FClashBack` 的 `/api/v1/subscriptions`，不是从同步快照里解析的。
