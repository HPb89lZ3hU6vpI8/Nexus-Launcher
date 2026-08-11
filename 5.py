"""
NexusGames - Desktop WebView Launcher
Mo cua so desktop (webview) hien thi website https://nexus-launcher-gold.vercel.app/
Khong co thanh dia chi, giong app desktop. Inject token de unlock web (gate).
Auto can bang kich thuoc cua so theo moi do phan giai / may (dung workarea).

NexusAPI: bridge Python cho JS (window.pywebview.api) de check Steam, cai/share NexusT.
Logic adapt tu Steam Project\Steam.py (registry, gdown, pyzipper, merge_and_replace).

FIX: An console SAU khi import OK. Neu thieu deps (webview/gdown/pyzipper),
giu console + in loi ro + pause de user biet cai gi thieu (debug duoc).
"""
import ctypes
import sys

# Kiem tra deps TRUOC khi an console. Neu fail -> in loi + pause -> user thay.
# SKIP check khi frozen (PyInstaller exe) - da bundle deps, khong can check runtime
# (tranh false positive do PyInstaller miss top-level import tren may khac).
# Chi check khi chay tu source (python 5.py) de bao user cai deps con thieu.
_MISSING = []
try:
    import secrets
    import threading
    import os
    import shutil
    import zipfile
    import traceback
    import subprocess
    import time
    import webbrowser
except ImportError as e:
    _MISSING.append(("stdlib", str(e)))

try:
    import webview
except ImportError as e:
    _MISSING.append(("pywebview", str(e)))

# requests la bat buoc (bootstrap portable tools + resolve Google Drive URL + redeem_code).
# gdown + pyzipper da bo — download dung aria2c portable, extract dung 7za portable,
# bootstrap ban dau dung requests + zipfile stdlib (khong can 2 lib nay nua).
try:
    import requests
except ImportError:
    _MISSING.append(("requests", "pip install requests"))

# Skip check khi frozen (PyInstaller exe da bundle deps).
# Chi bao loi khi chay tu source (python 5.py) de user biet cai gi thieu.
if _MISSING and not getattr(sys, 'frozen', False):
    print("=" * 60)
    print("NexusGames: THIEU DEPENDENCIES")
    print("=" * 60)
    for pkg, hint in _MISSING:
        print(f"  - {pkg}: {hint}")
    print()
    print("Cach fix: Chay file install.bat hoac:")
    print("  pip install -r requirements.txt")
    print("=" * 60)
    try:
        input("Nhan Enter de thoat...")
    except Exception:
        pass
    sys.exit(1)

# Tat ca deps OK -> an console (app chay binh thuong).
try:
    ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
except Exception:
    pass


# ====== LOGGER: ghi loi vao NexusBug.log cung thu muc exe/khi chay ======
# Chi log LOI (khong log success). Sanitize URL/file path de khong lo source.
# Format: [timestamp] [ERROR_TYPE] message (file:hidden function hidden)
def _nexus_log_file():
    """Tra duong dan NexusBug.log: cung thu mục voi .exe (frozen) hoac cwd."""
    try:
        if getattr(sys, 'frozen', False):
            base = os.path.dirname(sys.executable)
        else:
            base = os.path.dirname(os.path.abspath(__file__))
        return os.path.join(base, "NexusBug.log")
    except Exception:
        return os.path.join(os.getcwd(), "NexusBug.log")

def _nexus_sanitize(text):
    """An URL github + duong dan file de khong lo source. Giu error type + message.
    Thu tu: URL http(s) -> path co extension -> path Windows/Linux -> file.py:line."""
    if not isinstance(text, str):
        text = str(text)
    import re as _re
    # 1. An URL http/https (github/raw/pastefy/drive...) -> "[URL]"
    text = _re.sub(r'https?://[^\s\'"<>]+', '[URL]', text)
    # 2. An file co extension (.py/.dll/.lua/.exe/.zip/.bat/.txt/.ico/.png/.js/.json/.cfg/.ini/.md/.dat/.bin/.so/.dylib/.pem/.jar) co the co line:123
    text = _re.sub(r'(?:[A-Za-z]:)?[\\/]?(?:[^\s\'"<>:|?*]*[\\/])*[^\s\'"<>:|?*]+\.(?:py|dll|lua|exe|zip|bat|txt|ico|png|js|json|cfg|ini|md|dat|bin|so|dylib|pem|jar|log|tmp|cache|db)(?::\d+)?', '[FILE]', text, flags=_re.IGNORECASE)
    # 3. An duong dan Windows/Linux co dau \ hoac / va co the co khoang trang -> "[PATH]"
    # Path bat dau bang drive letter hoac / hoac \ va chua it nhat 1 dau / hoac \
    text = _re.sub(r'(?:[A-Za-z]:[\\/][^\s\'"<>]+)|(?:(?:[\\/]|[A-Za-z]:[\\/])[^\s\'"<>:|?*]+(?:[\\/][^\s\'"<>:|?*]+)+)', '[PATH]', text)
    # 4. An file.py:line don le (con sot lai sau buoc 2)
    text = _re.sub(r'\b[\w\-]+\.py(?::\d+)?', '[FILE]', text)
    # 5. An /secret/file.lua sau khi da thay path khong thay
    text = _re.sub(r'[\\/][\w\-\.]+\.(?:py|dll|lua|exe|zip|bat|txt|js|json|cfg|ini|md|dat|bin|so|dylib|pem|jar|log)', '[FILE]', text, flags=_re.IGNORECASE)
    return text

def _nexus_write_log(exc_type, exc_value, tb):
    """Ghi 1 entry loi vao NexusBug.log (append). Sanitize truoc khi ghi."""
    try:
        import datetime
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Traceback: lay 5 frame cuoi, sanitize path/file
        tb_str = "".join(traceback.format_exception(exc_type, exc_value, tb))
        tb_lines = tb_str.splitlines()
        # Giu 8 dong cuoi (du context, khong dai qua) + sanitize
        tb_sanitized = "\n".join(_nexus_sanitize(line) for line in tb_lines[-8:])
        err_type = exc_type.__name__ if exc_type else "Error"
        err_msg = _nexus_sanitize(str(exc_value)) if exc_value else ""
        entry = f"[{ts}] [{err_type}] {err_msg}\n{tb_sanitized}\n{'='*60}\n"
        with open(_nexus_log_file(), "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception:
        pass  # Logger fail khong duoc gay crash app.

def _nexus_excepthook(exc_type, exc_value, tb):
    """Global hook: bat moi exception khong duoc try/except -> log + in stderr."""
    try:
        _nexus_cleanup_lua()  # cleanup .lua trước khi crash
    except Exception:
        pass
    _nexus_write_log(exc_type, exc_value, tb)
    # Goi default hook de van in stderr (debug khi chay source).
    sys.__excepthook__(exc_type, exc_value, tb)

# Cai hook toan cuc -> bat moi loi unhandled (syntax error, code error, crash).
sys.excepthook = _nexus_excepthook

# Thread hook: exception trong thread cung phai log (mac dinh thread khong re-raise).
try:
    import threading
    _orig_threading_excepthook = threading.excepthook
    def _nexus_thread_excepthook(args):
        try:
            _nexus_cleanup_lua()  # cleanup .lua trước khi thread crash
        except Exception:
            pass
        _nexus_write_log(args.exc_type, args.exc_value, args.exc_traceback)
        _orig_threading_excepthook(args)
    threading.excepthook = _nexus_thread_excepthook
except Exception:
    pass
# ====== END LOGGER ======

# ====== LUA CLEANUP — xóa .lua files trong {steam_path}\opensteamtool\Nexus ======
def _nexus_cleanup_lua(steam_path=None):
    """Xóa tất cả file .lua trong {steam_path}\\opensteamtool\\Nexus (non-recursive).
    Bỏ qua file lỗi (lock, permission). Không xóa folder, không xóa .json/.exe.
    Chạy lúc startup + mọi exit path (X button, atexit, crash, Ctrl-C)."""
    if not steam_path:
        try:
            import winreg
            for key_path in (r"SOFTWARE\WOW6432Node\Valve\Steam", r"SOFTWARE\Valve\Steam"):
                try:
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as key:
                        steam_path, _ = winreg.QueryValueEx(key, "InstallPath")
                        break
                except OSError:
                    continue
        except Exception:
            return
    if not steam_path:
        return
    nexus_dir = os.path.join(steam_path, "opensteamtool", "Nexus")
    if not os.path.isdir(nexus_dir):
        return  # folder không tồn tại → exit bình thường
    try:
        files = os.listdir(nexus_dir)
    except OSError:
        return
    if not files:
        return  # folder rỗng → exit bình thường
    for fname in files:
        if fname.lower().endswith(".lua"):
            fpath = os.path.join(nexus_dir, fname)
            try:
                os.remove(fpath)
            except OSError:
                pass  # bỏ qua file lỗi (lock, permission)
# ====== END LUA CLEANUP ======


# Bridge Python<->JS: JS goi await window.pywebview.api.method(args) -> Python chay -> tra dict.
# pywebview tu dispatch thread rieng -> UI khong freeze.
class NexusAPI:
    """API expose cho JS qua pywebview js_api. Method tra dict (JSON-serializable)."""

    def _log_error(self, e, context=""):
        """Helper: log loi vao NexusBug.log (sanitize URL/file de khong lo source).
        Dung trong except blocks de log moi loi nho/lon. Khong raise.
        NOTE: Logger fail thi silent (khong de quy goi chinh no -> crash)."""
        try:
            _nexus_write_log(type(e), e, e.__traceback__)
            if context:
                try:
                    import datetime
                    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    with open(_nexus_log_file(), "a", encoding="utf-8") as f:
                        f.write("[" + ts + "] [CONTEXT] " + context + "\n")
                except Exception:
                    pass
        except Exception:
            pass

    # ---- Link/password (cai NexusT vs share game khac nhau) ----
    NEXUST_FILE_ID = "1WFbB2_VqIdII5GEZwk-AIJ4etzWnWz2p"
    NEXUST_ZIP_PW = b"EuZ4Qtt4aPdSanQoLY1xJP0rmsVL86Rktw3OfEMk642GUx2eMj"

    LUA_FILE_ID = "1EuWNvUx40qIb0GflkX7hQdecXRz3yk7T"
    LUA_ZIP_PW = b"QMORfFW7Hw9GotO5c7moq3DySWxagyfsh16RGsxwKiL1KKWUZk"

    # Cloud Save (CloudRedirect.zip): 4 file (opensteamtool.toml + cloud_redirect.dll ->
    # steam root; config.json + google_tokens.json -> steam\opensteamtool\Nexus).
    CLOUD_REDIRECT_FILE_ID = "10MSVhMQCj9Zdbe__0QUhbWFVIkGSr3mQ"
    CLOUD_REDIRECT_ZIP_PW = b"g909WcmxHuu6KChqIGP74hBs8q34LO2miHbeYSJP7Kgf4zvCxD"
    CLOUD_REDIRECT_ZIP_NAME = "CloudRedirect.zip"

    # ---- Fluenty UI (Millennium Steam skin) ----
    # Flow: check_steam → kill steam → gdown Steam.zip → 7za extract (password)
    #       → move TOÀN BỘ file/folder vào steam_path (gồm Millennium/ + wsock32.dll)
    #       → xóa zip → relaunch steam.
    # Uninstall: kill steam → xóa Millennium/ + wsock32.dll trong steam_path.
    FLUENTY_FILE_ID = "1OHYJtiDBH0zyMzDcD5hsjdEHU1Sj3hnM"
    FLUENTY_ZIP_PW = b"pfSZMNMRDH1eQddGR4PHA0mlF1b4apPVLlA7PtRyIJeB5SvrN2"
    FLUENTY_ZIP_NAME = "Steam.zip"
    FLUENTY_THEME_REL = os.path.join("millennium", "themes", "fluenty")

    # ---- Tích hợp Việt Hóa (CanhCutTeam + GameThuầnViệt portable) ----
    # Cấu trúc folder: %APPDATA%\NexusHideout\VietHoa\<folder>\<exe>
    # Flow: bấm KÍCH HOẠT NGAY → download zip (aria2c) → extract (7za + password)
    #       → xóa zip → nút thành KHỞI CHẠY → bấm → launch exe.
    # Mỗi tool có folder riêng, không check folder của tool khác.
    INTEGRATIONS = {
        'canhcut': {
            'folder': 'CanhCutTeam',                    # NexusHideout\VietHoa\CanhCutTeam
            'zip_name': 'CanhCutTeam_Portable.zip',
            'exe_name': 'CanhCutTeam.exe',
            'file_id': '1bbuc5cfmDNEXCpyBXDVCsb--j6rc4Kmx',
            'zip_pw': b'3qf6caHRb0hcyoCCBkb1KFbdl58ntx06oanYwArtFpRK6epdGZ',
        },
        'thuanviet': {
            'folder': 'GameThuanViet',                  # NexusHideout\VietHoa\GameThuanViet
            'zip_name': 'GameThuanViet_Portable.zip',
            'exe_name': 'GameThuanViet.exe',
            'file_id': '1K5KGIRQzInv40C0xphDbEpMvw5iQvH1g',
            'zip_pw': b'lxMyFdcGO69r1LiQlqKV7TnjWoxNZx3qQjB1A9Lnf0163KTWiT',
        },
    }

    # Tickets cho game redeem (Denuvo) — Da xoa hardcoded ticket khoi auto flow.
    # AppTicket + ETicket CHỈ được ghi vao registry khi user redeem code thanh cong qua redeem_code().
    REDEEM_TICKETS = {}

    # ---- Custom install flow (Buzzheavier download → 7z extract → registry → 3 nút) ----
    # Game KHONG dung steam/nexust/lua flow nhu game khac.
    # Flow: check file size → chọn folder cài → check disk (2x) →
    #       aria2c download → 7z extract → save path registry → 3 nut launch/uninstall/open.
    # Path ghi nho vao HKCU registry, chi xoa khi user Go Cai Dat.
    # Download tu Buzzheavier (KHONG Google Drive) — link truc tiep, khong token/cookie.
    # Them game: them 1 entry dict (key = AppID string).
    # NOTE: download_url/zip_pw = placeholder ('TODO') — thay bang link Buzzheavier
    # that khi co. App van chay, chi khong download duoc cho game chua co link.
    CUSTOM_GAMES = {
        '201870': {  # Assassin's Creed Revelations
            'download_url': ('https://ts.buzzheavier.com/d/h5jycv4m0k1s'
                             '?v=lp-ZSNhYludaPXR6u_j19KYNOOfu-wcoWdykp-pfCzDheaAaLc'
                             'RIriady4NnDhxGuDmYiYzT3o5D6PiHWYUV_eR2t_w4M5H_t_HbtOi'
                             'W6UMOHtdC-y_Jse9cXe8aPqbfuV5bwX1KOCYZYKNgpglZFldC7ah'
                             'rePmlopD6Y1ZQLSg'),
            'zip_pw': b'Es1etXKQi91piIbppJwoEeua24JNo2DOIVe7mP8XKSXSxWZ66i',
            'nexusg': '201870-NexusG',
            'game_subdir': "Assassin's Creed® Revelations",
            'exe': 'ACRSP.exe',
            'zip_name': '201870.zip',
            'reg_key': r'Software\NexusGames\Revelations',
        },
        '33230': {  # Assassin's Creed 2
            'download_url': ('https://ts.buzzheavier.com/d/ehzate7oewgm'
                             '?v=24NvlqV9dFYlampAcwcBGXW9AyQh3tBvkqOOcww2yFnqTrOQKRu'
                             'DSGrrhRP48vbYX0KdhR0qifd1fCt_WQ6CEbO12d1mXE7ptYBSPGok'
                             '3OZ2bnELlij50Mbm0R85fbSh6CvRh7ur6qSP8brmxvWzjHlcUs7dQIw9'
                             'Hd01YA85'),
            'zip_pw': b'36ovH2croxmItttpiAZAmSIV1EFxdsb8eZAYhylvz4Ttljx3N6C',
            'nexusg': '33230-NexusG',
            'game_subdir': "Assassin's Creed 2",
            'exe': 'AssassinsCreed2.exe',
            'zip_name': '33230.zip',
            'reg_key': r'Software\NexusGames\AssassinsCreed2',
        },
        # --- Them 8 game moi (offline, free, cloud save + local save) ---
        # Bus Simulator 16
        '324310': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '324310-NexusG',
            'game_subdir': "Bus Simulator 16",
            'exe': 'BusSimulator16.exe',
            'zip_name': '324310.zip',
            'reg_key': r'Software\NexusGames\BusSimulator16',
        },
        # Bus Simulator 18
        '515180': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '515180-NexusG',
            'game_subdir': "Bus Simulator 18",
            'exe': 'BusSimulator18.exe',
            'zip_name': '515180.zip',
            'reg_key': r'Software\NexusGames\BusSimulator18',
        },
        # Bus Simulator 21 Next Stop
        '976590': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '976590-NexusG',
            'game_subdir': "Bus Simulator 21 Next Stop",
            'exe': 'BusSimulator21NextStop.exe',
            'zip_name': '976590.zip',
            'reg_key': r'Software\NexusGames\BusSimulator21NextStop',
        },
        # Bus Simulator 23
        '2414950': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '2414950-NexusG',
            'game_subdir': "Bus Simulator 23",
            'exe': 'BusSimulator23.exe',
            'zip_name': '2414950.zip',
            'reg_key': r'Software\NexusGames\BusSimulator23',
        },
        # Bus Simulator 27
        '2397320': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '2397320-NexusG',
            'game_subdir': "Bus Simulator 27",
            'exe': 'BusSimulator27.exe',
            'zip_name': '2397320.zip',
            'reg_key': r'Software\NexusGames\BusSimulator27',
        },
        # Wuchang: Fallen Feathers
        '2277560': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '2277560-NexusG',
            'game_subdir': "Wuchang Fallen Feathers",
            'exe': 'Wuchang.exe',
            'zip_name': '2277560.zip',
            'reg_key': r'Software\NexusGames\WuchangFallenFeathers',
        },
        # Granblue Fantasy: Relink
        '881020': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '881020-NexusG',
            'game_subdir': "Granblue Fantasy Relink",
            'exe': 'granblue_fantasy_relink.exe',
            'zip_name': '881020.zip',
            'reg_key': r'Software\NexusGames\GranblueFantasyRelink',
        },
        # Totally Accurate Battle Simulator
        '508440': {
            'download_url': 'TODO',
            'zip_pw': b'',
            'nexusg': '508440-NexusG',
            'game_subdir': "Totally Accurate Battle Simulator",
            'exe': 'TABS.exe',
            'zip_name': '508440.zip',
            'reg_key': r'Software\NexusGames\TABS',
        },
    }

    # ---- Helpers ----
    def _get_steam_install_path(self):
        # Doc registry HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath (fallback Software\Valve\Steam)
        try:
            import winreg
            for key_path in (r"SOFTWARE\WOW6432Node\Valve\Steam", r"SOFTWARE\Valve\Steam"):
                try:
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as key:
                        install_path, _ = winreg.QueryValueEx(key, "InstallPath")
                        return install_path
                except OSError as e:
                    self._log_error(e, "_get_steam_install_path")
                    continue
        except Exception as e:
            self._log_error(e, "_get_steam_install_path")
            return None
        return None

    def _parse_vdf(self, text):
        """Parser VDF (Valve Data Format) → nested dict.
        Xu ly escape \\\\ → \\, \\" → \", \\n → newline.
        Dung cho libraryfolders.vdf + appmanifest_{appid}.acf."""
        import re as _re
        # Tokenize: quoted strings + braces.
        tokens = []
        i = 0
        while i < len(text):
            c = text[i]
            if c == '{' or c == '}':
                tokens.append(c)
                i += 1
            elif c == '"':
                j = i + 1
                buf = []
                while j < len(text) and text[j] != '"':
                    if text[j] == '\\' and j + 1 < len(text):
                        nxt = text[j + 1]
                        if nxt == '\\':
                            buf.append('\\'); j += 2
                        elif nxt == '"':
                            buf.append('"'); j += 2
                        elif nxt == 'n':
                            buf.append('\n'); j += 2
                        else:
                            buf.append(text[j]); buf.append(nxt); j += 2
                    else:
                        buf.append(text[j]); j += 1
                tokens.append(''.join(buf))
                i = j + 1
            else:
                i += 1
        # Parse tokens → nested dict (recursive descent).
        def _parse(tokens, pos):
            result = {}
            while pos < len(tokens):
                if tokens[pos] == '}':
                    return result, pos + 1
                key = tokens[pos]; pos += 1
                if pos < len(tokens) and tokens[pos] == '{':
                    value, pos = _parse(tokens, pos + 1)
                    result[key] = value
                elif pos < len(tokens):
                    result[key] = tokens[pos]; pos += 1
                else:
                    break
            return result, pos
        data, _ = _parse(tokens, 0)
        return data

    def _resolve_game_dir(self, steam_path, app_id, game_folder=None):
        """Resolve thu muc cai dat game DYNAMIC (khong tinh).
        1. Doc {steam_path}\\config\\libraryfolders.vdf → lay danh sach library paths + appIDs.
        2. Tim app_id trong apps cua tung library → biet game o library nao (path).
        3. Doc {library_path}\\steamapps\\appmanifest_{app_id}.acf → lay installdir (ten folder game).
        4. game_dir = {library_path}\\steamapps\\common\\{installdir}.
        Fallback: {steam_path}\\steamapps\\common\\{game_folder} neu dynamic fail.
        Tra game_dir (str) hoac None neu khong tim thay."""
        app_id_str = str(app_id).strip() if app_id else ""
        # 1. Thu dynamic resolution qua libraryfolders.vdf + appmanifest.acf.
        if app_id_str and steam_path:
            try:
                vdf_path = os.path.join(steam_path, "config", "libraryfolders.vdf")
                if os.path.isfile(vdf_path):
                    with open(vdf_path, "r", encoding="utf-8", errors="replace") as f:
                        data = self._parse_vdf(f.read())
                    libs = data.get("libraryfolders", {})
                    if isinstance(libs, dict):
                        for _lib_id, lib_info in libs.items():
                            if not isinstance(lib_info, dict):
                                continue
                            lib_path = lib_info.get("path", "")
                            if not lib_path:
                                continue
                            apps = lib_info.get("apps", {})
                            if not isinstance(apps, dict) or app_id_str not in apps:
                                continue
                            # Tim thay! app_id nam trong library nay.
                            # Doc appmanifest_{appid}.acf → lay installdir.
                            acf_path = os.path.join(lib_path, "steamapps",
                                                     f"appmanifest_{app_id_str}.acf")
                            installdir = ""
                            if os.path.isfile(acf_path):
                                with open(acf_path, "r", encoding="utf-8",
                                          errors="replace") as f:
                                    acf_data = self._parse_vdf(f.read())
                                installdir = acf_data.get("AppState", {}).get(
                                    "installdir", "")
                            # Dung installdir tu appmanifest, hoac fallback game_folder.
                            folder_name = installdir or game_folder or ""
                            if folder_name:
                                game_dir = os.path.join(lib_path, "steamapps",
                                                         "common", folder_name)
                                if os.path.isdir(game_dir):
                                    return game_dir
            except Exception as e:
                self._log_error(e, "_resolve_game_dir")
        # 2. Fallback: static path (hanh vi cu) — {steam_path}\\steamapps\\common\\{game_folder}.
        if game_folder and steam_path:
            fallback = os.path.join(steam_path, "steamapps", "common", game_folder)
            if os.path.isdir(fallback):
                return fallback
            # Tra path ngay ca khi chua ton tai (de fix_game bao "chua cai").
            return fallback
        return None

    # ====== PALWORLD LANGUAGE (SteamFix.ini) ======
    # Palworld (AppID 1623730) dung Goldberg Steam Emulator → SteamFix.ini trong
    # game folder: {game_dir}\Pal\Binaries\Win64\SteamFix.ini.
    # File nay co dong "Language=xxx" (Steam language code).
    # Backend: check_palworld_steamfix (read-only) + set_palworld_language (ghi Language=).
    PALWORLD_APPID = "1623730"
    PALWORLD_STEAMFIX_SUBPATH = os.path.join("Pal", "Binaries", "Win64",
                                             "SteamFix.ini")

    def _palworld_steamfix_path(self, steam_path):
        """Resolve duong dan SteamFix.ini cua Palworld (AppID 1623730).
        Dung _resolve_game_dir (libraryfolders.vdf + appmanifest.acf) → biet
        game o library nao + folder name chinh xac. Fallback static 'Palworld'.
        Tra (steamfix_path, game_dir) hoac (None, None) neu khong resolve duoc."""
        game_dir = self._resolve_game_dir(steam_path, self.PALWORLD_APPID,
                                          "Palworld")
        if not game_dir:
            return (None, None)
        steamfix_path = os.path.join(game_dir, self.PALWORLD_STEAMFIX_SUBPATH)
        return (steamfix_path, game_dir)

    def check_palworld_steamfix(self, steam_path):
        """Check Palworld (AppID 1623730) co file SteamFix.ini khong.
        Path: {game_dir}\\Pal\\Binaries\\Win64\\SteamFix.ini (game_dir resolve dynamic).
        Read-only: KHONG sua file. Tra dict:
          {installed: bool (game_dir ton tai),
           has_steamfix: bool (file SteamFix.ini ton tai),
           language: str|None (gia tri 'Language=' hien tai, None neu chua co file),
           steamfix_path: str|None}."""
        try:
            if not steam_path or not os.path.isdir(steam_path):
                return {"installed": False, "has_steamfix": False,
                        "language": None, "steamfix_path": None}
            steamfix_path, game_dir = self._palworld_steamfix_path(steam_path)
            if not game_dir or not os.path.isdir(game_dir):
                return {"installed": False, "has_steamfix": False,
                        "language": None, "steamfix_path": None}
            if not steamfix_path or not os.path.isfile(steamfix_path):
                return {"installed": True, "has_steamfix": False,
                        "language": None, "steamfix_path": None}
            # Parse SteamFix.ini → tim dong 'Language=...'.
            language = None
            try:
                with open(steamfix_path, "r", encoding="utf-8",
                          errors="replace") as f:
                    for line in f:
                        stripped = line.strip()
                        if stripped.lower().startswith("language="):
                            language = stripped.split("=", 1)[1].strip()
                            # Bo quote neu co (Language="vietnamese").
                            if len(language) >= 2 and language[0] in "\"'" \
                                    and language[-1] == language[0]:
                                language = language[1:-1]
                            break
            except Exception as e:
                self._log_error(e, "check_palworld_steamfix")
            return {"installed": True, "has_steamfix": True,
                    "language": language, "steamfix_path": steamfix_path}
        except Exception as e:
            self._log_error(e, "check_palworld_steamfix")
            return {"installed": False, "has_steamfix": False,
                    "language": None, "steamfix_path": None}

    def set_palworld_language(self, steam_path, language_code):
        """Ghi dong 'Language=' trong SteamFix.ini cua Palworld (AppID 1623730).
        1. Resolve steamfix_path (nhu check_palworld_steamfix).
        2. Neu file khong ton tai → {success: False, error: '...'}.
        3. Doc file → thay dong 'Language=...' bang 'Language={language_code}'.
           Neu khong co dong Language= → them vao (sau [Main] neu co, else dau file).
        4. Ghi lai file (giu nguyen cac dong khac).
        Tra {success: bool, error: str|None}."""
        try:
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False, error: "Thư mục Steam không tồn tại"}
            if not language_code or not isinstance(language_code, str):
                return {"success": False, error: "Thiếu mã ngôn ngữ"}
            language_code = language_code.strip()
            steamfix_path, game_dir = self._palworld_steamfix_path(steam_path)
            if not steamfix_path or not os.path.isfile(steamfix_path):
                return {"success": False,
                        "error": "SteamFix.ini không tồn tại. Hãy Fix Game trước."}
            # Doc file → list dong.
            with open(steamfix_path, "r", encoding="utf-8",
                      errors="replace") as f:
                lines = f.readlines()
            # 2-PASS: (1) thay dong Language= DAU TIEN, bo cac dong Language= thua
            # (dedup — fix file bi hỏng do version cu insert duplicate).
            # (2) ghi nho index [Main] de them Language= sau do neu khong co.
            new_lines = []
            found = False  # da thay 1 dong Language= chua?
            main_index = -1  # index cua [Main] trong new_lines
            for line in lines:
                stripped = line.strip()
                if stripped.lower().startswith("language="):
                    if not found:
                        # Dong Language= dau tien → thay bang gia tri moi.
                        new_lines.append(f"Language={language_code}\n")
                        found = True
                    # else: bo dong Language= thua (dedup).
                else:
                    new_lines.append(line)
                    if stripped.lower() == "[main]":
                        main_index = len(new_lines) - 1
            # Neu file KHONG co dong Language= nao → them moi (sau [Main] neu co).
            if not found:
                if main_index >= 0:
                    new_lines.insert(main_index + 1,
                                     f"Language={language_code}\n")
                else:
                    new_lines.insert(0, f"Language={language_code}\n")
            # Ghi lai file.
            with open(steamfix_path, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
            return {"success": True, "error": None}
        except Exception as e:
            self._log_error(e, "set_palworld_language")
            return {"success": False,
                    "error": f"{type(e).__name__}: {str(e)}"}

    def _check_cloud_toml(self, toml_path):
        """READ-ONLY check opensteamtool.toml co section [cloud] voi enabled = true.
        KHONG sua file. Thu tomllib (Py 3.11+) truoc, fallback line-based parser.
        Tra True/False/None (None = file khong doc duoc)."""
        if not toml_path or not os.path.isfile(toml_path):
            return False
        # 1) tomllib (Python 3.11+) — parser chuan, chiu dau ngoat, multiline, escape.
        try:
            import tomllib
            with open(toml_path, "rb") as f:
                data = tomllib.load(f)
            cloud = data.get("cloud", {})
            if isinstance(cloud, dict):
                return cloud.get("enabled") is True
            return False
        except ImportError:
            pass  # Python < 3.11 -> fallback line-based.
        except Exception as e:
            self._log_error(e, "_check_cloud_toml.tomllib")
            # Parse fail (syntax error) -> thu fallback line-based truoc khi return False.
        # 2) Fallback line-based — chi parse enough de tim [cloud]\nenabled = true.
        try:
            with open(toml_path, "r", encoding="utf-8", errors="replace") as f:
                in_cloud = False
                for line in f:
                    stripped = line.strip()
                    if not stripped or stripped.startswith("#"):
                        continue
                    # Section header [name] (bo subtable dot: [a.b] van xu ly duoc).
                    if stripped.startswith("[") and stripped.endswith("]"):
                        in_cloud = (stripped[1:-1].strip().lower() == "cloud")
                        continue
                    if not in_cloud:
                        continue
                    if "=" in stripped:
                        key, _, val = stripped.partition("=")
                        if key.strip().lower() == "enabled":
                            v = val.strip().strip('"').strip("'").lower()
                            # Bo comment cuoi dong (TOML khong cho comment trong value
                            # string, nhung de an toan: cat tai # ngoai quote).
                            if '#' in v:
                                v = v.split('#', 1)[0].strip()
                            return v == "true"
            return False
        except Exception as e:
            self._log_error(e, "_check_cloud_toml.fallback")
            return None

    def _find_in_extract(self, extract_dir, fname):
        """Tim file fname trong extract_dir — dau tien o root, sau do walk subfolder
        (zip co the co wrapper folder). Tra path day du hoac None."""
        root_candidate = os.path.join(extract_dir, fname)
        if os.path.isfile(root_candidate):
            return root_candidate
        for dirpath, dirnames, filenames in os.walk(extract_dir):
            if fname in filenames:
                return os.path.join(dirpath, fname)
        return None

    def _prepare_hideout(self):
        # Tao thu muc an NexusHideout trong %APPDATA% (pattern giong Steam.py).
        appdata = os.getenv('APPDATA') or os.path.expanduser("~")
        hidden_dir = os.path.join(appdata, "NexusHideout")
        os.makedirs(hidden_dir, exist_ok=True)
        try:
            FILE_ATTRIBUTE_HIDDEN = 0x02
            ctypes.windll.kernel32.SetFileAttributesW(hidden_dir, FILE_ATTRIBUTE_HIDDEN)
        except Exception as e:
            self._log_error(e, "_prepare_hideout")
            pass
        return hidden_dir

    def _cleanup_hideout(self, hidden_dir):
        # Chi xoa extracted_files + zip con sot lai — GIU 'Apps For Nexus Launcher'
        # (chua 7za.exe + aria2c.exe portable cho cac op download/extract sau).
        try:
            FILE_ATTRIBUTE_HIDDEN = 0x02
            ctypes.windll.kernel32.SetFileAttributesW(hidden_dir, FILE_ATTRIBUTE_HIDDEN)
        except Exception as e:
            self._log_error(e, "_cleanup_hideout")
            pass
        # Xoa thu muc extracted_files (ket qua giai nen tam thoi).
        extracted = os.path.join(hidden_dir, "extracted_files")
        try:
            if os.path.exists(extracted):
                shutil.rmtree(extracted, ignore_errors=True)
        except Exception as e:
            self._log_error(e, "_cleanup_hideout")
            pass
        # Xoa chi file .zip con sot lai o root (KHONG xoa 'Apps For Nexus Launcher').
        try:
            for name in os.listdir(hidden_dir):
                full = os.path.join(hidden_dir, name)
                if os.path.isfile(full) and name.lower().endswith(".zip"):
                    try:
                        os.remove(full)
                    except Exception:
                        pass
        except Exception as e:
            self._log_error(e, "_cleanup_hideout")
            pass

    def _download_zip_pure(self, hidden_dir, zip_filename, file_id):
        """Download file tu Google Drive ve hidden_dir bang PURE PYTHON (requests).
        Chi dung cho BOOTSTRAP portable tools (7za/aria2c chua co) — cac op download
        sau khi co aria2 se dung _download_zip (aria2c, 16 conns).
        Dung drive.usercontent.google.com (endpoint download truc tiep, ~10MB/s)
        thay vi drive.google.com/uc (bGoogle throttle non-browser -> 78KB/s -> 15ph cho 70MB).
        Xu ly confirm page (file >100MB Google tra HTML -> parse confirm+uuid -> retry).
        Return zip_path hoac raise Exception."""
        try:
            import requests
        except ImportError as e:
            self._log_error(e, "_download_zip_pure")
            raise Exception("Thiếu thư viện requests. Cài: pip install requests")
        zip_path = os.path.join(hidden_dir, zip_filename)
        # Endpoint download truc tiep (khong bi throttle nhu /uc).
        base = "https://drive.usercontent.google.com/download"
        params = {"id": file_id, "export": "download", "confirm": "t"}
        # Desktop UA.
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                 "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
        sess = requests.Session()
        last_err = None
        for attempt in range(1, 4):  # 3 lan retry.
            try:
                r = sess.get(base, params=params, stream=True, timeout=30, headers=headers)
                # File >100MB hoac flagged -> Google tra trang HTML confirm page (chu khong phai file).
                ct = (r.headers.get("content-type") or "").lower()
                cd = (r.headers.get("content-disposition") or "").lower()
                if "text/html" in ct or "attachment" not in cd:
                    # La confirm page -> parse confirm + uuid, retry voi token.
                    import re
                    body = r.text
                    r.close()
                    # Confirm token co the o form hoac JS. Lay ca 2 pattern.
                    m_conf = re.search(r'confirm=([0-9A-Za-z_-]+)', body)
                    m_uuid = re.search(r'name="uuid"\s+value="([^"]+)"', body) \
                             or re.search(r'"uuid":"([^"]+)"', body)
                    if m_conf:
                        p2 = dict(params)
                        p2["confirm"] = m_conf.group(1)
                        if m_uuid:
                            p2["uuid"] = m_uuid.group(1)
                        r = sess.get(base, params=p2, stream=True, timeout=30, headers=headers)
                    else:
                        raise Exception("Google Drive tra confirm page nhung khong parse duoc token")
                total = int(r.headers.get("Content-Length", 0) or 0)
                r.raise_for_status()
                # Ghi voi chunk 8MB -> giam overhead, toi da toc do.
                with open(zip_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
                        if chunk:
                            f.write(chunk)
                r.close()
                if os.path.exists(zip_path) and os.path.getsize(zip_path) > 0:
                    if total and os.path.getsize(zip_path) != total:
                        raise Exception(f"File khong day du: {os.path.getsize(zip_path)}/{total} bytes")
                    return zip_path
                raise Exception("File tai ve bi rong")
            except Exception as e:
                self._log_error(e, "_download_zip_pure")
                last_err = e
                try:
                    if os.path.exists(zip_path):
                        os.remove(zip_path)
                except Exception as e:
                    self._log_error(e, "_download_zip_pure")
                    pass
                time.sleep(1.5 * attempt)  # backoff.
        raise Exception(f"Download that bai sau 3 lan: {last_err}")

    def _get_7z_portable(self):
        """Tra duong dan 7za.exe portable (lay tu bootstrap), None neu chua co.
        Duong dan: %APPDATA%\\NexusHideout\\Apps For Nexus Launcher\\7z\\7za.exe."""
        appdata = os.getenv('APPDATA')
        if not appdata:
            return None
        p = os.path.join(appdata, "NexusHideout", "Apps For Nexus Launcher", "7z", "7za.exe")
        return p if os.path.isfile(p) else None

    def _get_aria2_portable(self):
        """Tra duong dan aria2c.exe portable (lay tu bootstrap), None neu chua co.
        Duong dan: %APPDATA%\\NexusHideout\\Apps For Nexus Launcher\\aria2\\aria2c.exe."""
        appdata = os.getenv('APPDATA')
        if not appdata:
            return None
        p = os.path.join(appdata, "NexusHideout", "Apps For Nexus Launcher", "aria2", "aria2c.exe")
        return p if os.path.isfile(p) else None

    def _resolve_gdrive_url(self, file_id):
        """Pre-resolve Google Drive direct URL + cookies (handle confirm page cho file >100MB).
        Dung requests headers-only — KHONG tai body (aria2c se tai body voi 16 connections).
        Tra (final_url, cookie_header)."""
        import requests, re
        from urllib.parse import urlencode
        base = "https://drive.usercontent.google.com/download"
        params = {"id": file_id, "export": "download", "confirm": "t"}
        # Desktop UA (giong _download_zip_pure) — Google khong throttle browser UA.
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                 "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
        sess = requests.Session()
        r = sess.get(base, params=params, stream=True, timeout=30, headers=headers)
        try:
            ct = (r.headers.get("content-type") or "").lower()
            cd = (r.headers.get("content-disposition") or "").lower()
            if "text/html" in ct or "attachment" not in cd:
                # File >100MB hoac flagged -> Google tra trang HTML confirm page (nho).
                # Parse confirm token + uuid, retry voi token (KHONG tai body file).
                body = r.text
                r.close()
                # Detect quota exceeded page (file download qua nhieu → GDrive block 24h).
                # Tra message ro rang cho user (khong phai "khong parse duoc token").
                if "Quota exceeded" in body or "Too many users" in body \
                   or "you can&#39;t view or download" in body \
                   or "you can't view or download" in body:
                    raise Exception(
                        "Google Drive vuot quota download (file bi tai qua nhieu). "
                        "GDrive block 24h. Thu lai sau, hoac dung link mirror."
                    )
                m_conf = re.search(r'confirm=([0-9A-Za-z_-]+)', body)
                m_uuid = re.search(r'name="uuid"\s+value="([^"]+)"', body) \
                         or re.search(r'"uuid":"([^"]+)"', body)
                if not m_conf:
                    raise Exception("Google Drive tra confirm page nhung khong parse duoc token")
                params["confirm"] = m_conf.group(1)
                if m_uuid:
                    params["uuid"] = m_uuid.group(1)
                r = sess.get(base, params=params, stream=True, timeout=30, headers=headers)
            # Lay cookies tu session (download_warning, NID, ...) de aria2c gui theo header.
            cookies = "; ".join(f"{k}={v}" for k, v in sess.cookies.items())
            final_url = base + "?" + urlencode(params)
        finally:
            try:
                r.close()  # KHONG doc body — chi can headers + cookies.
            except Exception:
                pass
        return final_url, cookies

    def _download_zip(self, hidden_dir, zip_filename, file_id):
        """Download file tu Google Drive bang aria2c.exe portable (16 conns, resume).
        Pre-resolve confirm token + cookies bang requests (handle file >100MB),
        sau do aria2c tai body voi 16 connections -> nhanh hon requests thuần.
        Tra zip_path hoac raise Exception."""
        aria2c = self._get_aria2_portable()
        if not aria2c:
            raise Exception("Thieu aria2c.exe portable — bootstrap portable tools chua hoan tat")
        zip_path = os.path.join(hidden_dir, zip_filename)
        # Pre-resolve Google Drive URL + cookies (tranh aria2c tai nham HTML confirm page).
        download_url, cookie_header = self._resolve_gdrive_url(file_id)
        # Xoa file cu + .aria2 control file con sot lai (download moi tu dau hoac resume).
        try:
            if os.path.exists(zip_path):
                os.remove(zip_path)
            ctrl = zip_path + ".aria2"
            if os.path.exists(ctrl):
                os.remove(ctrl)
        except Exception as e:
            self._log_error(e, "_download_zip")
            pass
        cmd = [aria2c,
               '-x16',           # max 16 connections per server.
               '-s16',           # split file thanh 16 segments.
               '-k1M',           # min split size 1MB.
               '-c',             # continue/resume download.
               '-d', hidden_dir, # output directory.
               '-o', zip_filename,  # output filename.
               '--retry-wait=2', # wait 2s giua retry.
               '-m5',            # max 5 retries.
               '--file-allocation=none',  # khong pre-allocate (giam disk churn).
               '--console-log-level=error',
               '--summary-interval=0',
               '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
               'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36']
        if cookie_header:
            cmd += ['--header', f'Cookie: {cookie_header}']
        cmd += [download_url]
        try:
            result = subprocess.run(cmd, capture_output=True,
                                    creationflags=0x08000000, timeout=600)
        except subprocess.TimeoutExpired as e:
            self._log_error(e, "_download_zip")
            raise Exception("aria2c download timeout (10 phut)")
        except Exception as e:
            self._log_error(e, "_download_zip")
            raise
        if result.returncode != 0:
            err = (result.stderr or result.stdout).decode(errors='replace')[:300]
            self._log_error(Exception(err), "_download_zip")
            raise Exception(f"aria2c download fail (code {result.returncode}): {err}")
        if not os.path.exists(zip_path) or os.path.getsize(zip_path) == 0:
            raise Exception("aria2c tai ve rong hoac missing")
        return zip_path

    def _extract_zip_pure(self, zip_path, dest_dir):
        """Giai nen bootstrap zip bang PURE PYTHON (zipfile stdlib) — KHONG password, KHONG 7z.
        Zip nay do user tao bang WinRAR -> zipfile stdlib xu ly duoc (khong AES).
        Sau khi extract: neu zip chi chua 7z/ + aria2/ o root (khong parent folder)
        -> di chuyen vao 'Apps For Nexus Launcher' de dung cau truc chuan.
        Tra dest_dir."""
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(dest_dir)
        # Robustness: dong bo hoa cau truc voi _ensure_portable_tools ky vong.
        apps_dir = os.path.join(dest_dir, "Apps For Nexus Launcher")
        if not os.path.isdir(os.path.join(apps_dir, "7z")):
            # Co the zip chi chua '7z' + 'aria2' o root -> move vao apps_dir.
            root_7z = os.path.join(dest_dir, "7z")
            root_aria2 = os.path.join(dest_dir, "aria2")
            if os.path.isdir(root_7z) or os.path.isdir(root_aria2):
                os.makedirs(apps_dir, exist_ok=True)
                if os.path.isdir(root_7z) and not os.path.exists(os.path.join(apps_dir, "7z")):
                    shutil.move(root_7z, os.path.join(apps_dir, "7z"))
                if os.path.isdir(root_aria2) and not os.path.exists(os.path.join(apps_dir, "aria2")):
                    shutil.move(root_aria2, os.path.join(apps_dir, "aria2"))
        return dest_dir

    def _extract_zip(self, zip_path, extract_dir, pwd):
        """Giai nen zip co mat khau bang 7za.exe portable (AES native C, nhanh 40x pyzipper).
        7za.exe + 7za.dll/7zxa.dll lay tu bootstrap (%APPDATA%\\NexusHideout\\Apps For Nexus Launcher\\7z).
        Chay voi cwd = thu muc 7za de no tim duoc DLL di kem neu can.
        Return extract_dir (da tao)."""
        if os.path.exists(extract_dir):
            shutil.rmtree(extract_dir, ignore_errors=True)
        os.makedirs(extract_dir, exist_ok=True)
        seven_zip = self._get_7z_portable()
        if not seven_zip:
            raise Exception("Thieu 7za.exe portable — bootstrap portable tools chua hoan tat")
        pw_str = pwd.decode('utf-8') if isinstance(pwd, bytes) else str(pwd)
        # -bb0 = no progress output, -bso0 -bse0 = no stdout/stderr (chi error).
        # Tranh pipe deadlock: 7za output progress lien tuc → capture_output pipe
        # day (64KB) → 7za block → subprocess timeout (282KB roi treo).
        cmd = [seven_zip, 'x', zip_path, '-o' + extract_dir, '-y',
               '-bb0', '-bso0', '-bse2']
        if pw_str:  # Chi them -p khi zip co password.
            cmd.insert(2, '-p' + pw_str)
        seven_zip_dir = os.path.dirname(seven_zip)
        try:
            # stdout=DEVNULL (khong capture) → 7za khong block pipe.
            # stderr=PIPE (chi doc error khi fail) → nho, khong deadlock.
            result = subprocess.run(cmd, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.PIPE,
                                    creationflags=0x08000000,
                                    timeout=1800,  # 30 phut (file 6GB extract lau).
                                    cwd=seven_zip_dir)
        except subprocess.TimeoutExpired as e:
            self._log_error(e, "_extract_zip")
            raise Exception("7za extract timeout (30 phut)")
        except Exception as e:
            self._log_error(e, "_extract_zip")
            raise
        # 7z exit 0 = ok, 1 = warning (van extract day du), >=2 = fatal error.
        if result.returncode > 1 or not (os.path.isdir(extract_dir) and os.listdir(extract_dir)):
            err = (result.stderr or result.stdout).decode(errors='replace')[:300]
            self._log_error(Exception(err), "_extract_zip")
            raise Exception(f"7za extract fail (code {result.returncode}): {err}")
        return extract_dir

    def _ensure_portable_tools(self):
        """Check %APPDATA%\\NexusHideout\\Apps For Nexus Launcher co {7z, aria2} chua.
        Neu missing -> bootstrap PURE PYTHON (requests download + zipfile extract,
        KHONG dung 7z/aria2 vi chua co), xoa .zip.
        Sau bootstrap: TAT CA op download dung aria2c, TAT CA op extract dung 7za portable.
        Chay DONG BO o main() ngay sau khi co admin, truoc khi mo UI."""
        hidden_dir = self._prepare_hideout()
        apps_dir = os.path.join(hidden_dir, "Apps For Nexus Launcher")
        seven_zip_dir = os.path.join(apps_dir, "7z")
        aria2_dir = os.path.join(apps_dir, "aria2")
        # Fast path: ca 2 thu muc deu co -> return ngay (instant lan sau).
        if os.path.isdir(seven_zip_dir) and os.path.isdir(aria2_dir):
            return
        # Missing 1 trong 2 (hoac ca apps_dir khong co) -> bootstrap bang PURE PYTHON.
        zip_filename = "Apps For Nexus Launcher.zip"
        zip_path = os.path.join(hidden_dir, zip_filename)
        # Google Drive file ID cua "Apps For Nexus Launcher.zip" — KHONG password.
        file_id = "1ur65lCCp4amLtPYLyW-_WXW8L6khMzA9"
        try:
            self._download_zip_pure(hidden_dir, zip_filename, file_id)
            self._extract_zip_pure(zip_path, hidden_dir)
        finally:
            # Xoa .zip sau khi giai nen — chi giu folder da extract.
            try:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
            except Exception as e:
                self._log_error(e, "_ensure_portable_tools")
                pass
        # Verify bootstrap thanh cong: ca 2 thu muc deu phai co sau extract.
        if not (os.path.isdir(seven_zip_dir) and os.path.isdir(aria2_dir)):
            raise Exception("Bootstrap portable tools that bai: thieu 7z hoac aria2 "
                            f"(kiem tra zip Google Drive file ID {file_id})")

    def _merge_and_replace_all(self, src_dir, dst_dir):
        # Move TOAN BO file/folder tu src -> dst (replace). Giong Steam.py merge_and_replace.
        for root, dirs, files in os.walk(src_dir):
            rel_path = os.path.relpath(root, src_dir)
            target_path = dst_dir if rel_path == '.' else os.path.join(dst_dir, rel_path)
            os.makedirs(target_path, exist_ok=True)
            for file in files:
                src_file = os.path.join(root, file)
                dst_file = os.path.join(target_path, file)
                if os.path.exists(dst_file):
                    os.remove(dst_file)
                shutil.move(src_file, dst_file)

    def _elevated_merge(self, src_dir, dst_dir):
        """Khi ghi vao dst_dir bi PermissionError (Steam o Program Files),
        spawn helper .bat voi quyen admin (UAC prompt) de copy bang robocopy.
        Tra True neu thanh cong, False neu user tu choi UAC / timeout / robocopy fail.
        Robocopy exit code < 8 = thanh cong (0=ko can copy, 1=copy xong, ...)."""
        import ctypes
        import time
        temp_dir = os.getenv('TEMP', os.path.expanduser('~'))
        flag_path = os.path.join(temp_dir, "_nx_merge_done.flag")
        bat_path = os.path.join(temp_dir, "_nx_merge.bat")
        # Xoa flag cu neu co.
        try:
            if os.path.exists(flag_path): os.remove(flag_path)
        except Exception as e:
            self._log_error(e, "_elevated_merge")
            pass
        # .bat: robocopy /E (copy tat ca + overwrite), /R:2 /W:2 (2 retry x 2s, tranh hang),
        # quiet, ghi exit code vao flag. .bat tu xoa khong tin cay duoc (cmd giu file),
        # nen Python se xoa .bat sau khi doc flag (luc do .bat da thoat).
        with open(bat_path, "w") as f:
            f.write('@echo off\n')
            f.write(f'robocopy "{src_dir}" "{dst_dir}" /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP >nul 2>&1\n')
            f.write(f'echo %errorlevel% > "{flag_path}"\n')
        # Spawn voi "runas" verb = UAC prompt. SW_HIDE = 0 (an cua so).
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", bat_path, None, None, 0)
        if ret <= 32:
            # User tu choi UAC hoac loi.
            try: os.remove(bat_path)
            except Exception as e:
                self._log_error(e, "_elevated_merge")
            return False
        # Poll cho flag file (timeout 300s — robocopy file lon co the cham).
        deadline = time.time() + 300
        while time.time() < deadline:
            if os.path.exists(flag_path):
                try:
                    with open(flag_path) as ff:
                        code = int(ff.read().strip())
                    os.remove(flag_path)
                    # Robocopy: <8 = ok (0..7), >=8 = fail.
                    ok = code < 8
                except Exception as e:
                    self._log_error(e, "_elevated_merge")
                    try: os.remove(flag_path)
                    except Exception as e:
                        self._log_error(e, "_elevated_merge")
                    ok = False
                # Don dep .bat (da thoat, khong con bi lock).
                try: os.remove(bat_path)
                except Exception as e:
                    self._log_error(e, "_elevated_merge")
                return ok
            time.sleep(0.5)
        # Timeout — don dep .bat (co the van dang chay, xoa that bai khong sao).
        try: os.remove(bat_path)
        except Exception as e:
            self._log_error(e, "_elevated_merge")
        return False

    def _elevated_copy_single(self, src_file, dst_dir):
        """Spawn admin .bat de copy 1 file vao dst_dir (cho share_game khi PermissionError).
        Tra True neu thanh cong (copy exit code 0)."""
        import ctypes
        import time
        temp_dir = os.getenv('TEMP', os.path.expanduser('~'))
        flag_path = os.path.join(temp_dir, "_nx_copy_done.flag")
        bat_path = os.path.join(temp_dir, "_nx_copy.bat")
        try:
            if os.path.exists(flag_path): os.remove(flag_path)
        except Exception as e:
            self._log_error(e, "_elevated_copy_single")
            pass
        with open(bat_path, "w") as f:
            f.write('@echo off\n')
            f.write(f'if not exist "{dst_dir}" mkdir "{dst_dir}"\n')
            f.write(f'copy /Y "{src_file}" "{dst_dir}\\" >nul 2>&1\n')
            f.write(f'echo %errorlevel% > "{flag_path}"\n')
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", bat_path, None, None, 0)
        if ret <= 32:
            try: os.remove(bat_path)
            except Exception as e:
                self._log_error(e, "_elevated_copy_single")
            return False
        deadline = time.time() + 60
        while time.time() < deadline:
            if os.path.exists(flag_path):
                try:
                    with open(flag_path) as ff:
                        code = int(ff.read().strip())
                    os.remove(flag_path)
                    ok = code == 0  # copy: 0 = ok.
                except Exception as e:
                    self._log_error(e, "_elevated_copy_single")
                    try: os.remove(flag_path)
                    except Exception as e:
                        self._log_error(e, "_elevated_copy_single")
                    ok = False
                try: os.remove(bat_path)
                except Exception as e:
                    self._log_error(e, "_elevated_copy_single")
                return ok
            time.sleep(0.5)
        try: os.remove(bat_path)
        except Exception as e:
            self._log_error(e, "_elevated_copy_single")
        return False

    def _kill_steam(self):
        """Tat Steam (steam.exe) truoc khi ghi vao Steam folder.
        Steam dang chay -> lock DLL (crashhandler.dll, steam.dll...) ->
        merge fail / robocopy skip file dang lock -> install khong day du.
        Force kill + poll exit 15s. Return True neu Steam da tat (hoac chua chay)."""
        try:
            out = subprocess.check_output(
                'tasklist /FI "IMAGENAME eq steam.exe" /NH',
                shell=True, creationflags=134217728
            ).decode("utf-8", errors="ignore").lower()
            if "steam.exe" not in out:
                return True  # Khong chay -> OK.
        except Exception as e:
            self._log_error(e, "_kill_steam")
            pass
        try:
            subprocess.run('taskkill /f /im steam.exe >nul 2>&1',
                          shell=True, creationflags=134217728)
        except Exception as e:
            self._log_error(e, "_kill_steam")
            pass
        # Poll cho Steam exit (timeout 15s).
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                out = subprocess.check_output(
                    'tasklist /FI "IMAGENAME eq steam.exe" /NH',
                    shell=True, creationflags=134217728
                ).decode("utf-8", errors="ignore").lower()
                if "steam.exe" not in out:
                    return True
            except Exception as e:
                self._log_error(e, "_kill_steam")
                return True
            time.sleep(0.5)
        return False  # Timeout — Steam van chay.

    def _launch_steam(self, steam_path):
        """Khoi dong lai steam.exe tu steam_path sau khi cai/go Fluenty.
        Non-blocking (Popen), khong cho Steam ready — UI khong bi block."""
        try:
            exe = os.path.join(steam_path, "steam.exe")
            if os.path.isfile(exe):
                subprocess.Popen([exe], cwd=steam_path,
                                 creationflags=0x08000000)  # CREATE_NO_WINDOW
                return True
        except Exception as e:
            self._log_error(e, "_launch_steam")
        return False

    def _steam_running(self):
        """Check steam.exe đang chạy không (non-destructive, không kill)."""
        try:
            out = subprocess.check_output(
                'tasklist /FI "IMAGENAME eq steam.exe" /NH',
                shell=True, creationflags=134217728
            ).decode("utf-8", errors="ignore").lower()
            return "steam.exe" in out
        except Exception as e:
            self._log_error(e, "_steam_running")
            return False

    def _open_steam_library_game(self, app_id, steam_path=None):
        """[After done] Mở Steam + select game trong library theo appid.
        Steam đang chạy -> chỉ mở steam://nav/games/details/<appid>.
        Steam tắt -> khởi động Steam + mở steam://nav/games/details/<appid>."""
        try:
            app_id_str = str(app_id).strip()
            if not app_id_str:
                return
            if not self._steam_running():
                if not steam_path:
                    steam_path = self._get_steam_install_path()
                if steam_path:
                    self._launch_steam(steam_path)
                    # Đợi Steam khởi động (tối đa 10s)
                    for _ in range(20):
                        time.sleep(0.5)
                        if self._steam_running():
                            break
            webbrowser.open(f"steam://nav/games/details/{app_id_str}")
        except Exception as e:
            self._log_error(e, "_open_steam_library_game")

    # ---- API methods (goi tu JS) ----
    def check_steam(self):
        """Kiem tra Steam co cai khong (doc registry). Tra {installed, path}."""
        try:
            path = self._get_steam_install_path()
            installed = bool(path) and os.path.isdir(path) if path else False
            return {"installed": installed, "path": path or ""}
        except Exception as e:
            self._log_error(e, "check_steam")
            return {"installed": False, "path": "", "error": str(e)}

    def check_nexust(self, steam_path):
        """Kiem tra {steam_path}\\opensteamtool\\Nexus co khong. Tra {installed}."""
        try:
            if not steam_path:
                return {"installed": False, "error": "Thiếu đường dẫn Steam"}
            nexus_dir = os.path.join(steam_path, "opensteamtool", "Nexus")
            return {"installed": os.path.isdir(nexus_dir)}
        except Exception as e:
            self._log_error(e, "check_nexust")
            return {"installed": False, "error": str(e)}

    def install_nexust(self, steam_path):
        """Cai NexusT: gdown Nexus.zip -> giai nen -> move TOAN BO vao steam_path. Tra {success, error}.
        Neu ghi vao steam_path bi PermissionError (Steam o Program Files),
        tu spawn UAC prompt (robocopy xong) -> khong can user tu run as admin.
        Truoc khi tai: neu Steam dang chay -> tat Steam hoan toan -> file DLL khong bi lock."""
        try:
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False, "error": "Thư mục Steam không tồn tại"}
            # Tat Steam truoc khi tai/giai nen/merge -> file DLL khong bi lock -> merge day du.
            # Neu Steam khong chay -> _kill_steam tra True ngay, khong doi.
            self._kill_steam()
            hidden_dir = self._prepare_hideout()
            try:
                zip_path = self._download_zip(hidden_dir, "Nexus.zip", self.NEXUST_FILE_ID)
                extract_dir = os.path.join(hidden_dir, "extracted_files")
                self._extract_zip(zip_path, extract_dir, self.NEXUST_ZIP_PW)
                # Xoa zip sau khi giai nen.
                try:
                    os.remove(zip_path)
                except Exception as e:
                    self._log_error(e, "install_nexust")
                    pass
                # Move TOAN BO file/folder vao steam_path (replace).
                # Neu PermissionError (Steam o Program Files) -> spawn UAC robocopy.
                try:
                    self._merge_and_replace_all(extract_dir, steam_path)
                except PermissionError as e:
                    self._log_error(e, "install_nexust")
                    ok = self._elevated_merge(extract_dir, steam_path)
                    if not ok:
                        return {"success": False,
                                "error": "Cần cấp quyền Administrator (UAC) để ghi vào thư mục Steam. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
            finally:
                # Luon cleanup NexusHideout du thanh cong hay fail.
                self._cleanup_hideout(hidden_dir)
            return {"success": True}
        except Exception as e:
            self._log_error(e, "install_nexust")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    # ---- Memory Cleaner (Tối ưu bộ nhớ RAM 24/24 khi Launcher mở) ----
    _mem_cleaner_active = False
    _mem_cleaner_thread = None

    def _get_protected_game_pids(self, current_pid):
        """Lọc và lấy danh sách các PID được BẢO VỆ 4 LỚP (Bảo vệ 100% Game Steam & Game Engine)."""
        protected_pids = {current_pid}
        game_pids = set()
        try:
            import psutil
            import ctypes
            kernel32 = ctypes.windll.kernel32
            psapi = ctypes.windll.psapi
            PROCESS_QUERY_INFORMATION = 0x0400
            PROCESS_VM_READ = 0x0010

            system_core_names = {
                'system', 'csrss.exe', 'lsass.exe', 'services.exe', 'smss.exe', 
                'wininit.exe', 'dwman.exe', 'dwm.exe', 'explorer.exe'
            }

            for proc in psutil.process_iter(['pid', 'name', 'exe']):
                try:
                    pid = proc.info['pid']
                    if pid <= 4:
                        protected_pids.add(pid)
                        continue

                    name = (proc.info['name'] or '').lower()
                    exe = (proc.info['exe'] or '').lower()

                    if name in system_core_names:
                        protected_pids.add(pid)
                        continue

                    # CHỈ BẢO VỆ GAME TRONG THƯ MỤC STEAMAPPS\COMMON HOẶC GAMES
                    if '\\steamapps\\common\\' in exe or '\\games\\' in exe:
                        protected_pids.add(pid)
                        game_pids.add(pid)
                        continue

                    if any(kw in name for kw in ['shipping', '-win64-', 'wukong', 'palworld', 'eldenring', 'cyberpunk', 're4']):
                        protected_pids.add(pid)
                        game_pids.add(pid)
                        continue

                    # Kiểm tra tiến trình con của Steam (trừ steamwebhelper & steamservice)
                    try:
                        parent = proc.parent()
                        if parent and parent.name().lower() == 'steam.exe' and name not in ['steamwebhelper.exe', 'steamservice.exe']:
                            protected_pids.add(pid)
                            game_pids.add(pid)
                            continue
                    except Exception:
                        pass
                except Exception:
                    pass

            for proc in psutil.process_iter(['pid']):
                try:
                    pid = proc.info['pid']
                    if pid in protected_pids or pid <= 4:
                        continue
                    hProc = kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
                    if hProc:
                        hMods = (ctypes.c_void_p * 512)()
                        cbNeeded = ctypes.c_ulong()
                        if psapi.EnumProcessModules(hProc, ctypes.byref(hMods), ctypes.sizeof(hMods), ctypes.byref(cbNeeded)):
                            count = int(cbNeeded.value / ctypes.sizeof(ctypes.c_void_p))
                            for i in range(min(count, 64)):
                                modName = (ctypes.c_wchar * 260)()
                                if psapi.GetModuleBaseNameW(hProc, hMods[i], modName, 260):
                                    m_str = modName.value.lower()
                                    if m_str in ['steam_api.dll', 'steam_api64.dll', 'unityplayer.dll', 
                                                'd3d11.dll', 'd3d12.dll', 'vulkan-1.dll', 'xinput1_4.dll']:
                                        protected_pids.add(pid)
                                        game_pids.add(pid)
                                        break
                        kernel32.CloseHandle(hProc)
                except Exception:
                    pass
        except Exception as e:
            self._log_error(e, "_get_protected_game_pids")
        return protected_pids, game_pids

    # ---- HÀM 1 CLEAN RAM SÂU: Dọn Working Set Ứng dụng Ngầm (Mượt không gây Spike CPU) ----
    def _do_clean_working_set(self, protected_pids):
        """HÀM 1 CLEAN RAM SÂU: Quét và giải phóng Working Set + Heap Allocation của tất cả ứng dụng ngầm rảnh rỗi."""
        try:
            import ctypes
            import psutil
            import time
            kernel32 = ctypes.windll.kernel32
            psapi = ctypes.windll.psapi
            PROCESS_SET_QUOTA = 0x0100
            PROCESS_QUERY_INFORMATION = 0x0400

            count = 0
            for proc in psutil.process_iter(['pid']):
                try:
                    pid = proc.info['pid']
                    if pid <= 4 or pid in protected_pids:
                        continue
                    hProcess = kernel32.OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, False, pid)
                    if not hProcess:
                        hProcess = kernel32.OpenProcess(0x001F0FFF, False, pid)
                    if hProcess:
                        psapi.EmptyWorkingSet(hProcess)
                        kernel32.SetProcessWorkingSetSize(hProcess, ctypes.c_size_t(-1), ctypes.c_size_t(-1))
                        kernel32.CloseHandle(hProcess)
                        count += 1
                        if count % 25 == 0:
                            time.sleep(0.002)  # Nghỉ 2ms mỗi 25 app để KHÔNG tạo spike CPU khi đang chơi Game
                except Exception:
                    pass
        except Exception as e:
            self._log_error(e, "_do_clean_working_set")

    # ---- HÀM 2 CLEAN RAM SÂU: Dọn Kernel Standby List & Cache Rác ----
    def _do_clean_standby_cache(self):
        """HÀM 2 CLEAN RAM SÂU: Gọi Kernel NtSetSystemInformation xóa sạch Standby List, Low Priority List & Modified Page List."""
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            advapi32 = ctypes.windll.advapi32
            ntdll = ctypes.windll.ntdll

            # Nâng quyền Token hệ thống (SeIncreaseQuotaPrivilege)
            TOKEN_ADJUST_PRIVILEGES = 0x0020
            TOKEN_QUERY = 0x0008
            SE_PRIVILEGE_ENABLED = 0x00000002

            class LUID(ctypes.Structure):
                _fields_ = [("LowPart", ctypes.c_ulong), ("HighPart", ctypes.c_long)]

            class LUID_AND_ATTRIBUTES(ctypes.Structure):
                _fields_ = [("Luid", LUID), ("Attributes", ctypes.c_ulong)]

            class TOKEN_PRIVILEGES(ctypes.Structure):
                _fields_ = [("PrivilegeCount", ctypes.c_ulong), ("Privileges", LUID_AND_ATTRIBUTES * 1)]

            hToken = ctypes.c_void_p()
            if advapi32.OpenProcessToken(kernel32.GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, ctypes.byref(hToken)):
                luid = LUID()
                if advapi32.LookupPrivilegeValueW(None, "SeIncreaseQuotaPrivilege", ctypes.byref(luid)):
                    tp = TOKEN_PRIVILEGES()
                    tp.PrivilegeCount = 1
                    tp.Privileges[0].Luid = luid
                    tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED
                    advapi32.AdjustTokenPrivileges(hToken, False, ctypes.byref(tp), ctypes.sizeof(tp), None, None)
                kernel32.CloseHandle(hToken)

            for command in [3, 4, 2, 1]:
                try:
                    cmd_val = ctypes.c_int(command)
                    ntdll.NtSetSystemInformation(0x50, ctypes.byref(cmd_val), ctypes.sizeof(cmd_val))
                except Exception:
                    pass
        except Exception as e:
            self._log_error(e, "_do_clean_standby_cache")

    # ---- HÀM 3 GAMING BOOST: Đẩy độ ưu tiên CPU Scheduler của Game lên HIGH_PRIORITY_CLASS ----
    def _do_boost_game_priority(self, game_pids):
        """HÀM 3 GAMING BOOST: Đẩy độ ưu tiên CPU của Game lên HIGH_PRIORITY_CLASS chống giật 1% Low FPS."""
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            HIGH_PRIORITY_CLASS = 0x00000080
            PROCESS_SET_INFORMATION = 0x0200
            PROCESS_QUERY_INFORMATION = 0x0400

            for gpid in game_pids:
                try:
                    hProc = kernel32.OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION, False, gpid)
                    if hProc:
                        kernel32.SetPriorityClass(hProc, HIGH_PRIORITY_CLASS)
                        kernel32.CloseHandle(hProc)
                except Exception:
                    pass
        except Exception as e:
            self._log_error(e, "_do_boost_game_priority")

    def _do_clean_ram(self):
        """Hàm tổng hợp kết hợp HÀM CLEAN RAM SÂU + GAMING BOOST CHỐNG GIẬT LAG."""
        try:
            import os
            import gc

            current_pid = os.getpid()
            protected_pids, game_pids = self._get_protected_game_pids(current_pid)

            # 1. HÀM 1 CLEAN RAM SÂU: Dọn Working Set Ứng dụng Ngầm
            self._do_clean_working_set(protected_pids)

            # 2. HÀM 2 CLEAN RAM SÂU: Dọn Standby List & Cache Rác Hệ Thống
            self._do_clean_standby_cache()

            # 3. HÀM 3 GAMING BOOST: Tự động đẩy độ ưu tiên CPU của Game lên HIGH chống giật 1% Low FPS
            if game_pids:
                self._do_boost_game_priority(game_pids)

            # 4. Thu hồi Garbage Collection của Python
            try:
                gc.collect()
            except Exception:
                pass
        except Exception as e:
            self._log_error(e, "_do_clean_ram")

    def _mem_cleaner_loop(self):
        """Vòng lặp kiểm tra RAM 24/24 ngầm hoàn toàn.
        - Mỗi lần kiểm tra nếu RAM > 80.0%, thực hiện 1 lượt dọn RAM sâu & Boost Game (_do_clean_ram).
        - Khi bấm VÔ HIỆU HÓA (_mem_cleaner_active = False), TẮT HOÀN TOÀN 100% luồng và hàm dọn RAM lập tức.
        """
        import time
        import psutil

        while getattr(self, "_mem_cleaner_active", False):
            try:
                mem = psutil.virtual_memory()
                if mem.percent > 80.0:
                    self._do_clean_ram()
            except Exception as e:
                self._log_error(e, "_mem_cleaner_loop")
            time.sleep(5)

    def check_mem_cleaner(self):
        """Kiểm tra trạng thái Kích Hoạt / Vô Hiệu Hóa của Memory Cleaner."""
        return {"active": bool(getattr(self, "_mem_cleaner_active", False))}

    def toggle_mem_cleaner(self):
        """Bật / Tắt tính năng dọn dẹp RAM 24/24 (Khi bấm Vô Hiệu Hóa -> TẮT 100% ALL LUỒNG VÀ HÀM MEMORY CLEANER)."""
        import threading
        try:
            current = getattr(self, "_mem_cleaner_active", False)
            if current:
                # VÔ HIỆU HÓA: Gán cờ False -> Vòng lặp _mem_cleaner_loop dừng hẳn 100%, tắt toàn bộ hàm clean
                self._mem_cleaner_active = False
                return {"active": False}
            else:
                # KÍCH HOẠT: Khởi chạy thread ngầm 24/24
                self._mem_cleaner_active = True
                t = threading.Thread(target=self._mem_cleaner_loop, daemon=True)
                self._mem_cleaner_thread = t
                t.start()
                return {"active": True}
        except Exception as e:
            self._log_error(e, "toggle_mem_cleaner")
            return {"active": False, "error": str(e)}

    def check_cloud_save(self):
        """Kiem tra Cloud Save da cai day du chua. READ-ONLY — khong sua file.
        Tra {installed: bool, steam_installed: bool}.
        4 dieu kien (TAT CA phai pass):
          1. cloud_redirect.dll ton tai o steam root (CHINH XAC ten file).
          2. opensteamtool.toml ton tai o steam root.
          3. opensteamtool.toml co section [cloud] + enabled = true.
          4. steam\\opensteamtool\\Nexus ton tai VA chua CA config.json + google_tokens.json."""
        try:
            steam_path = self._get_steam_install_path()
            if not steam_path or not os.path.isdir(steam_path):
                return {"installed": False, "steam_installed": False}
            # 4 dieu kien — that bai bat ky thi installed=False.
            ok_dll = os.path.isfile(os.path.join(steam_path, "cloud_redirect.dll"))
            toml_path = os.path.join(steam_path, "opensteamtool.toml")
            ok_toml_exists = os.path.isfile(toml_path)
            ok_toml_enabled = (self._check_cloud_toml(toml_path) is True) if ok_toml_exists else False
            nexus_dir = os.path.join(steam_path, "opensteamtool", "Nexus")
            ok_nexus_dir = os.path.isdir(nexus_dir)
            ok_nexus_files = (ok_nexus_dir
                              and os.path.isfile(os.path.join(nexus_dir, "config.json"))
                              and os.path.isfile(os.path.join(nexus_dir, "google_tokens.json")))
            installed = ok_dll and ok_toml_exists and ok_toml_enabled and ok_nexus_files
            return {"installed": bool(installed), "steam_installed": True}
        except Exception as e:
            self._log_error(e, "check_cloud_save")
            return {"installed": False, "steam_installed": False, "error": str(e)}

    def install_cloud_save(self):
        """Cai Cloud Save: kill Steam -> download CloudRedirect.zip -> giai nen ->
        move 4 file (2 ra steam root, 2 vao steam\\opensteamtool\\Nexus) -> re-check.
        Tra {success: bool, already: bool, error: str}.
        Zip chua: opensteamtool.toml, cloud_redirect.dll, config.json, google_tokens.json."""
        try:
            steam_path = self._get_steam_install_path()
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False, "error": "Không tìm thấy thư mục Steam"}
            # Da cai day du -> skip (idempotent).
            chk = self.check_cloud_save()
            if chk.get("installed"):
                return {"success": True, "already": True}
            # Tat Steam (file DLL/steam.exe lock -> move fail). Dung _kill_steam co san.
            self._kill_steam()
            hidden_dir = self._prepare_hideout()
            try:
                zip_path = self._download_zip(
                    hidden_dir, self.CLOUD_REDIRECT_ZIP_NAME, self.CLOUD_REDIRECT_FILE_ID)
                extract_dir = os.path.join(hidden_dir, "extracted_files")
                self._extract_zip(zip_path, extract_dir, self.CLOUD_REDIRECT_ZIP_PW)
                # Xoa zip sau khi giai nen.
                try:
                    os.remove(zip_path)
                except Exception as e:
                    self._log_error(e, "install_cloud_save")
                    pass
                # Tự động cài đặt NexusT trước nếu folder opensteamtool\Nexus chưa tồn tại.
                nexus_dir = os.path.join(steam_path, "opensteamtool", "Nexus")
                if not os.path.isdir(nexus_dir):
                    inst_res = self.install_nexust(steam_path)
                    if not inst_res.get("success"):
                        return {"success": False, "error": f"Cài đặt NexusT thất bại: {inst_res.get('error')}"}
                # Tạo dest Nexus folder trước (move cần dst dir tồn tại).
                try:
                    os.makedirs(nexus_dir, exist_ok=True)
                except Exception as e:
                    self._log_error(e, "install_cloud_save.makedirs")
                # File 1+2: opensteamtool.toml + cloud_redirect.dll -> steam root.
                # File 3+4: config.json + google_tokens.json -> steam\opensteamtool\Nexus.
                moves = [
                    ("opensteamtool.toml", steam_path),
                    ("cloud_redirect.dll", steam_path),
                    ("config.json", nexus_dir),
                    ("google_tokens.json", nexus_dir),
                ]
                elevated_failed = False
                for fname, dst_dir in moves:
                    src = self._find_in_extract(extract_dir, fname)
                    if not src:
                        continue  # Zip thieu file — re-check cuoi se bat.
                    dst = os.path.join(dst_dir, fname)
                    try:
                        if os.path.exists(dst):
                            try:
                                os.remove(dst)
                            except Exception as e:
                                self._log_error(e, "install_cloud_save.remove_dst")
                        shutil.move(src, dst)
                    except PermissionError as e:
                        # Steam o Program Files -> fallback UAC copy single file.
                        self._log_error(e, "install_cloud_save.move")
                        ok = self._elevated_copy_single(src, dst_dir)
                        if not ok:
                            elevated_failed = True
                if elevated_failed:
                    return {"success": False,
                            "error": "Cần cấp quyền Administrator (UAC) để ghi file Cloud Save. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
                # Re-check 4 dieu kien de xac nhan cai dat day du.
                chk2 = self.check_cloud_save()
                if chk2.get("installed"):
                    # Nếu cài đặt thành công và Steam chưa chạy -> khởi chạy duy nhất steam.exe
                    if not self._steam_running():
                        self._launch_steam(steam_path)
                    return {"success": True}
                return {"success": False,
                        "error": "Cài đặt xong nhưng kiểm tra lại thất bại — có thể file zip thiếu hoặc Steam không cài đúng thư mục."}
            finally:
                # Luon cleanup NexusHideout du thanh cong hay fail.
                self._cleanup_hideout(hidden_dir)
        except Exception as e:
            self._log_error(e, "install_cloud_save")
    def activate_easy_install_game(self, app_id):
        """Kich hoat Easy-Install Game theo AppID:
        1. Check steam_path.
        2. Check folder {steam_path}\\opensteamtool\\Nexus. Neu CHUA CO -> tu dong install_nexust(steam_path).
        3. Check file {steam_path}\\opensteamtool\\Nexus\\{app_id}.lua.
           - Neu DA CO -> tra {success: True, already_exists: True, message: "Bạn Đã Thêm Game Này"}.
           - Neu CHUA CO -> tai bang API hubcapmanifest.com -> luu vao {app_id}.lua -> check exist -> tra {success: True}."""
        try:
            app_id_str = str(app_id).strip()
            if not app_id_str or not app_id_str.isdigit():
                return {"success": False, "error": "AppID chỉ được chứa các chữ số"}

            steam_path = self._get_steam_install_path()
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False, "error": "Không tìm thấy thư mục cài đặt Steam trên hệ thống"}

            nexus_dir = os.path.join(steam_path, "opensteamtool", "Nexus")

            # 1. Neu folder opensteamtool\Nexus chua co -> tu dong cai NexusT.zip
            if not os.path.isdir(nexus_dir):
                inst_res = self.install_nexust(steam_path)
                if not inst_res.get("success"):
                    return {"success": False, "error": f"Cài đặt NexusT thất bại: {inst_res.get('error')}"}

            # Tao thu muc Nexus phong truong hop install_nexust tra ve ok nhung folder chua tao
            os.makedirs(nexus_dir, exist_ok=True)

            # 2. Check xem file {app_id}.lua da co chua
            target_lua = os.path.join(nexus_dir, f"{app_id_str}.lua")
            if os.path.isfile(target_lua):
                self._open_steam_library_game(app_id_str, steam_path)
                return {
                    "success": True,
                    "already_exists": True,
                    "message": "Bạn Đã Có Game Này",
                    "app_id": app_id_str,
                    "file_path": target_lua
                }

            # 3. Tai file Lua tu API
            api_key = "smm_28057cf3603c5fbe4268c1cb933e27890f424550498a0aeef3ea3b0715751351555173fee37338c1f365564ab4eacdca"
            url = f"https://hubcapmanifest.com/api/v1/lua/{app_id_str}"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
            }

            import urllib.request
            req = urllib.request.Request(url, headers=headers)
            download_ok = False
            err_detail = ""

            def strip_lua_comments(data_bytes):
                try:
                    text = data_bytes.decode('utf-8', 'ignore')
                    import re
                    text = re.sub(r'--\[\[.*?\]\]', '', text, flags=re.DOTALL)
                    text = re.sub(r'--.*', '', text)
                    text = '\n'.join([line for line in text.splitlines() if line.strip()])
                    return text.encode('utf-8')
                except Exception:
                    return data_bytes

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = resp.read()
                    if data and len(data) > 0:
                        data = strip_lua_comments(data)
                        with open(target_lua, "wb") as f:
                            f.write(data)
                        download_ok = True
                    else:
                        err_detail = "API trả về dữ liệu rỗng"
            except urllib.error.HTTPError as he:
                if he.code == 404:
                    err_detail = f"Trên Server Hiện Giờ Không Có Game Nào Có AppID Là: {app_id_str}"
                else:
                    err_detail = f"Lỗi kết nối API HTTP {he.code}"
            except Exception as e:
                # Fallback voi requests neu urllib bi ssl issue
                try:
                    import requests
                    r = requests.get(url, headers=headers, timeout=30)
                    if r.status_code == 200 and r.content:
                        content_stripped = strip_lua_comments(r.content)
                        with open(target_lua, "wb") as f:
                            f.write(content_stripped)
                        download_ok = True
                    elif r.status_code == 404:
                        err_detail = f"Trên Server Hiện Giờ Không Có Game Nào Có AppID Là: {app_id_str}"
                    else:
                        err_detail = f"Lỗi HTTP {r.status_code}"
                except Exception as req_e:
                    err_detail = str(e)

            if download_ok and os.path.isfile(target_lua) and os.path.getsize(target_lua) > 0:
                self._open_steam_library_game(app_id_str, steam_path)
                return {
                    "success": True,
                    "already_exists": False,
                    "message": f"Đã Kích Hoạt Thành Công Game Có AppID Là: {app_id_str}",
                    "app_id": app_id_str,
                    "file_path": target_lua
                }
            else:
                return {"success": False, "error": err_detail or "Tải file Lua thất bại"}

        except Exception as e:
            self._log_error(e, "activate_easy_install_game")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    def share_game(self, steam_path, appid):
        """Share game: gdown Lua.zip -> giai nen -> move DUY NHAT {appid}.lua vao Nexus folder.
        Tra {success, already, error}.
        Neu {appid}.lua da co trong Nexus folder -> already=true (khong move)."""
        try:
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False, "error": "Thư mục Steam không tồn tại"}
            nexus_dir = os.path.join(steam_path, "opensteamtool", "Nexus")
            os.makedirs(nexus_dir, exist_ok=True)

            lua_filename = f"{appid}.lua"
            target_lua = os.path.join(nexus_dir, lua_filename)
            # Da co -> khong move.
            if os.path.exists(target_lua):
                self._open_steam_library_game(appid, steam_path)
                return {"success": True, "already": True}

            hidden_dir = self._prepare_hideout()
            try:
                zip_path = self._download_zip(hidden_dir, "Lua.zip", self.LUA_FILE_ID)
                extract_dir = os.path.join(hidden_dir, "extracted_files")
                self._extract_zip(zip_path, extract_dir, self.LUA_ZIP_PW)
                try:
                    os.remove(zip_path)
                except Exception as e:
                    self._log_error(e, "share_game")
                    pass
                # Tim DUY NHAT {appid}.lua trong extract_dir (de quy vi file co the o thu muc con).
                src_lua = None
                for root, dirs, files in os.walk(extract_dir):
                    if lua_filename in files:
                        src_lua = os.path.join(root, lua_filename)
                        break
                if not src_lua or not os.path.exists(src_lua):
                    return {"success": False, "error": "Không Có Game Được Thêm Vào, Vui Lòng Báo Cáo Cho Admin"}
                # Move DUY NHAT {appid}.lua -> Nexus folder.
                # Neu PermissionError (Steam o Program Files) -> spawn UAC copy.
                try:
                    if os.path.exists(target_lua):
                        os.remove(target_lua)
                    shutil.move(src_lua, target_lua)
                except PermissionError as e:
                    self._log_error(e, "share_game")
                    ok = self._elevated_copy_single(src_lua, nexus_dir)
                    if not ok:
                        return {"success": False,
                                "error": "Cần cấp quyền Administrator (UAC) để ghi vào thư mục Steam. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
            finally:
                self._cleanup_hideout(hidden_dir)
            self._open_steam_library_game(appid, steam_path)
            return {"success": True, "already": False}
        except Exception as e:
            self._log_error(e, "share_game")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    def fix_game(self, steam_path, fix_data, app_id=None):
        """Fix game (online crack): gdown zip -> giai nen pass -> merge_and_replace vao game folder.
        Flow adapt tu Steam Project\\Fix.py (gdown + pyzipper + merge_and_replace).
        fix_data: {driveId, password, zipName, gameExe, gameFolder, [gameExes]}.
        app_id: Steam AppID (de resolve game_dir dynamic qua libraryfolders.vdf + appmanifest.acf).
        gameExes (optional, array): neu co -> check + kill TAT CA exe; else fallback gameExe don.

        1. Check Steam path + game folder + game exe(s). Chua cai -> {success False, not_installed True}.
        2. Kill game exe(s) neu dang chay.
        3. gdown zip -> giai nen pass -> merge_and_replace vao game folder (resolve dynamic).
        4. Cleanup NexusHideout.
        """
        try:
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False, "error": "Thư mục Steam không tồn tại"}
            if not fix_data:
                return {"success": False, "error": "Thiếu dữ liệu fix"}

            drive_id = fix_data.get("driveId", "")
            password = fix_data.get("password", "")
            zip_name = fix_data.get("zipName", "Fix.zip")
            game_exe = fix_data.get("gameExe", "")
            game_folder = fix_data.get("gameFolder", "")
            # gameExes (optional, array): check + kill TAT CA neu co; else fallback gameExe don.
            game_exes = fix_data.get("gameExes", [])

            if not (drive_id and password and game_exe and game_folder):
                return {"success": False, "error": "Dữ liệu fix không đầy đủ"}

            # 1. Check game folder ton tai (chua cai -> bao user).
            # Resolve game_dir DYNAMIC: libraryfolders.vdf + appmanifest.acf → biet game o library nao.
            # Fallback: static path {steam_path}\steamapps\common\{game_folder}.
            game_dir = self._resolve_game_dir(steam_path, app_id, game_folder)
            if not game_dir or not os.path.isdir(game_dir):
                return {"success": False, "not_installed": True,
                        "error": "Bạn chưa cài đặt game"}
            # Check exe(s) ton tai. gameExes (array) neu co -> check tat ca; else check gameExe don.
            if game_exes:
                for exe in game_exes:
                    if not os.path.isfile(os.path.join(game_dir, exe)):
                        return {"success": False, "not_installed": True,
                                "error": "Bạn chưa cài đặt game"}
            else:
                if not os.path.isfile(os.path.join(game_dir, game_exe)):
                    return {"success": False, "not_installed": True,
                            "error": "Bạn chưa cài đặt game"}

            # 2. Kill game exe(s) neu dang chay (tasklist check + taskkill).
            # gameExes co -> kill tat ca; else kill gameExe don.
            exes_to_kill = game_exes if game_exes else [game_exe]
            killed_any = False
            for exe in exes_to_kill:
                try:
                    out = subprocess.check_output(
                        f'tasklist /FI "IMAGENAME eq {exe}" /NH',
                        shell=True, creationflags=134217728
                    ).decode("utf-8", errors="ignore").lower()
                    if exe.lower() in out:
                        subprocess.run(
                            f'taskkill /f /im {exe} >nul 2>&1',
                            shell=True, creationflags=134217728
                        )
                        killed_any = True
                except Exception as e:
                    self._log_error(e, "fix_game")
                    pass
            if killed_any:
                time.sleep(1)

            # 3. gdown zip -> giai nen -> merge_and_replace vao game folder.
            hidden_dir = self._prepare_hideout()
            try:
                zip_path = self._download_zip(hidden_dir, zip_name, drive_id)
                extract_dir = os.path.join(hidden_dir, "extracted_files")
                self._extract_zip(zip_path, extract_dir, password.encode("utf-8"))
                try:
                    os.remove(zip_path)
                except Exception as e:
                    self._log_error(e, "fix_game")
                    pass
                # Merge TOAN BO file/folder vao game folder (replace).
                # Neu PermissionError (game folder o Program Files) -> spawn UAC robocopy.
                try:
                    self._merge_and_replace_all(extract_dir, game_dir)
                except PermissionError as e:
                    self._log_error(e, "fix_game")
                    ok = self._elevated_merge(extract_dir, game_dir)
                    if not ok:
                        return {"success": False,
                                "error": "Cần cấp quyền Administrator (UAC) để ghi vào thư mục game. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
            finally:
                self._cleanup_hideout(hidden_dir)
            return {"success": True}
        except Exception as e:
            self._log_error(e, "fix_game")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    def redeem_code(self, code, expected_appid):
        """Redeem code TokeerDRM: validate -> check custom DLL -> POST server -> verify app_id -> ghi registry.
        Adapt tu TokeerDRM Open Source\\tokeer_drm.py (redeem method).

        1. Validate code dung 6 ky tu (letters/digits, case-insensitive). Sai -> {invalid True}.
        2. Check custom DLL Tesla697 da cai (marker .tokeer_ost_custom trong Steam root).
           Chua cai -> {not_installed True}.
        3. POST server /drm/redeem {code}. Server tra {app_id, appticket, eticket, uses_remaining}.
        4. Check app_id match expected_appid. Sai -> {wrong_game True}.
        5. Ghi AppTicket + ETicket vao HKCU\\Software\\Valve\\Steam\\Apps\\{appid}.
        """
        try:
            # 1. Validate 6 ky tu (chi quan tam length, khong quan tam loai ky tu).
            clean = (code or "").strip().upper()
            if len(clean) != 6:
                return {"success": False, "invalid": True}

            # 2. Check custom DLL Tesla697 da cai (marker file trong Steam root).
            steam_path = self._get_steam_install_path()
            if not steam_path:
                return {"success": False, "not_installed": True}
            marker = os.path.join(steam_path, ".tokeer_ost_custom")
            if not os.path.isfile(marker):
                return {"success": False, "not_installed": True}

            # 3. POST server /drm/redeem.
            try:
                import requests
            except ImportError as e:
                self._log_error(e, "redeem_code")
                return {"success": False, "error": "Thiếu thư viện requests. Cài: pip install requests"}
            server_url = "http://31.57.38.79:8091"
            r = requests.post(server_url + "/drm/redeem", json={"code": clean}, timeout=25)
            data = r.json()
            if r.status_code != 200 or not data.get("success", False):
                reason = data.get("reason", data.get("error", "Server error"))
                return {"success": False, "code_not_found": True, "error": reason}

            app_id = data.get("app_id")
            appticket = data.get("appticket")
            eticket = data.get("eticket")
            uses_remaining = data.get("uses_remaining")
            if not (app_id and appticket and eticket):
                return {"success": False, "error": "Server trả về ticket không đầy đủ"}

            # 4. Check app_id match expected_appid (game hien tai).
            if str(app_id) != str(expected_appid):
                return {"success": False, "wrong_game": True, "returned_appid": str(app_id)}

            # 5. Ghi AppTicket + ETicket vao registry (dung helper chung voi auto flow).
            w = self._write_steam_tickets(app_id, appticket, eticket)
            if not w.get("success"):
                return {"success": False, "error": "Ghi registry that bai: " + w.get("error", "khong xac dinh")}
            return {"success": True, "app_id": str(app_id), "uses_remaining": uses_remaining,
                    "verified": w.get("verified", False)}
        except Exception as e:
            self._log_error(e, "redeem_code")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}


    # ====== DISABLE WINDOWS UPDATE (only cho 22 game redeem Denuvo) ======
    # Check WU: neu da disable -> skip. Neu dang bat -> tat hoan toan (services + tasks + registry HKLM).
    # Cross-build: Win10 1507-22H2 + Win11 21H2-25H2. Probe-or-skip: service/task khong ton tai -> skip.
    # Fail (user tu choi UAC / loi) -> warning, KHONG abort flow (write_registry + share_game van chay).
    # KHONG disable BITS + cryptsvc (break SCCM/Intune/MSI/driver/cert/signature).

    _WU_SERVICES = ('wuauserv', 'UsoSvc', 'WaaSMedicSvc', 'DoSvc', 'sedsvc', 'uhssvc')
    _WU_TASKS = (
        r'\Microsoft\Windows\WindowsUpdate\Scheduled Start',
        r'\Microsoft\Windows\WindowsUpdate\Refresh Group Policy Cache',
        r'\Microsoft\Windows\WaaSMedic\PerformRemediation',
        r'\Microsoft\Windows\UpdateOrchestrator\Schedule Scan',
        r'\Microsoft\Windows\UpdateOrchestrator\Schedule Scan Static Task',
        r'\Microsoft\Windows\UpdateOrchestrator\Schedule Work',
        r'\Microsoft\Windows\UpdateOrchestrator\Schedule Maintenance Work',
        r'\Microsoft\Windows\UpdateOrchestrator\USO_UxBroker',
        r'\Microsoft\Windows\UpdateOrchestrator\UUS Failover Task',
        r'\Microsoft\Windows\WindowsUpdate\sih',
        r'\Microsoft\Windows\WindowsUpdate\sihboot',
        r'\Microsoft\Windows\UpdateOrchestrator\Start Scan',
    )
    _WU_AU_PATH = r'SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
    _WU_DO_PATH = r'SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization'

    def _wu_service_start_type(self, svc):
        """Tra ve START_TYPE (int) cua service. None neu service khong ton tai (1060)."""
        try:
            r = subprocess.run(['sc', 'qc', svc], capture_output=True,
                               creationflags=0x08000000, timeout=15,
                               text=True, errors='ignore')
            if r.returncode != 0:
                return None  # 1060 = service khong ton tai -> skip
            m = re.search(r'START_TYPE\s*:\s*(\d+)', r.stdout)
            return int(m.group(1)) if m else None
        except Exception as e:
            self._log_error(e, "_wu_service_start_type")
            return None

    def _wu_service_disabled_or_skip(self, svc):
        """True neu START_TYPE==4 (disabled) HOAC service khong ton tai (skip)."""
        st = self._wu_service_start_type(svc)
        return st is None or st == 4

    def _wu_policy_dword(self, path, name):
        """Doc DWORD tu HKLM. None neu key/value khong ton tai."""
        try:
            import winreg
            k = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path, 0,
                               winreg.KEY_QUERY_VALUE | winreg.KEY_WOW64_64KEY)
            try:
                v, _ = winreg.QueryValueEx(k, name)
                return int(v)
            finally:
                winreg.CloseKey(k)
        except FileNotFoundError as e:
            self._log_error(e, "_wu_policy_dword")
            return None
        except OSError as e:
            self._log_error(e, "_wu_policy_dword")
            return None
        except Exception as e:
            self._log_error(e, "_wu_policy_dword")
            return None

    def _wu_task_disabled(self, path):
        """True neu task disabled HOAC task khong ton tai (skip)."""
        try:
            r = subprocess.run(['schtasks', '/query', '/tn', path, '/fo', 'LIST', '/v'],
                               capture_output=True, creationflags=0x08000000,
                               timeout=15, text=True, errors='ignore')
            if r.returncode != 0:
                return True  # task khong ton tai -> skip
            out = (r.stdout or '') + (r.stderr or '')
            # 'Scheduled Task State: Disabled' hoac 'Status: Disabled'
            return 'Disabled' in out
        except Exception as e:
            self._log_error(e, "_wu_task_disabled")
            return True

    def _wu_is_disabled(self):
        """Conjunctive AND check — 8 layer. Tat ca True -> WU da disable."""
        # 1-5. Services (probe-or-skip).
        services_ok = (
            self._wu_service_disabled_or_skip('wuauserv') and
            self._wu_service_disabled_or_skip('UsoSvc') and
            self._wu_service_disabled_or_skip('WaaSMedicSvc') and
            self._wu_service_disabled_or_skip('DoSvc') and
            (self._wu_service_disabled_or_skip('uhssvc') or
             self._wu_service_disabled_or_skip('sedsvc'))
        )
        if not services_ok:
            return False
        # 6. Registry NoAutoUpdate == 1.
        nau = self._wu_policy_dword(self._WU_AU_PATH, 'NoAutoUpdate')
        if nau != 1:
            return False
        # 7-8. Scheduled tasks.
        tasks_ok = (
            self._wu_task_disabled(r'\Microsoft\Windows\WaaSMedic\PerformRemediation') and
            self._wu_task_disabled(r'\Microsoft\Windows\WindowsUpdate\Scheduled Start')
        )
        return tasks_ok

    def _wu_disable_now(self):
        """Tat WU ngay (admin context). Stop services + disable start + disable tasks + ghi registry HKLM."""
        # 1. Stop services (best-effort, co the dang chay).
        for svc in self._WU_SERVICES:
            try:
                subprocess.run(['sc', 'stop', svc], capture_output=True,
                                creationflags=0x08000000, timeout=10)
            except Exception as e:
                self._log_error(e, "_wu_disable_now")
                pass
        # 2. Disable start type (probe-or-skip: sc config se fail neu service khong ton tai, OK).
        for svc in self._WU_SERVICES:
            try:
                subprocess.run(['sc', 'config', svc, 'start=', 'disabled'],
                               capture_output=True, creationflags=0x08000000, timeout=10)
            except Exception as e:
                self._log_error(e, "_wu_disable_now")
                pass
        # 3. Disable scheduled tasks (probe-or-skip).
        for tp in self._WU_TASKS:
            try:
                r = subprocess.run(['schtasks', '/query', '/tn', tp],
                                   capture_output=True, creationflags=0x08000000,
                                   timeout=10, text=True, errors='ignore')
                if r.returncode != 0:
                    continue  # task khong ton tai
                subprocess.run(['schtasks', '/change', '/tn', tp, '/disable'],
                               capture_output=True, creationflags=0x08000000, timeout=10)
            except Exception as e:
                self._log_error(e, "_wu_disable_now")
                pass
        # 4. Registry HKLM (NoAutoUpdate + NoAutoRebootWithLoggedOnUsers + DODownloadMode).
        try:
            import winreg
            for path, name, value in (
                (self._WU_AU_PATH, 'NoAutoUpdate', 1),
                (self._WU_AU_PATH, 'NoAutoRebootWithLoggedOnUsers', 1),
                (self._WU_DO_PATH, 'DODownloadMode', 0),
            ):
                k = winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, path, 0,
                                       winreg.KEY_SET_VALUE | winreg.KEY_WOW64_64KEY)
                try:
                    winreg.SetValueEx(k, name, 0, winreg.REG_DWORD, value)
                finally:
                    winreg.CloseKey(k)
        except Exception as e:
            self._log_error(e, "_wu_disable_now")
            pass

    def _wu_disable_elevated(self):
        """Spawn .bat runas (UAC) de chay _wu_disable_now tuong duong. Poll flag file.
        Tra: 'disabled' | 'warning:<msg>' | 'warning:uac_declined'."""
        temp_dir = os.getenv('TEMP', os.path.expanduser('~'))
        flag_path = os.path.join(temp_dir, "_nx_wu_done.flag")
        bat_path = os.path.join(temp_dir, "_nx_wu.bat")
        try:
            if os.path.exists(flag_path):
                os.remove(flag_path)
        except Exception as e:
            self._log_error(e, "_wu_disable_elevated")
            pass
        # .bat noi cac lenh sc + schtasks + reg add.
        lines = ['@echo off']
        for svc in self._WU_SERVICES:
            lines.append('sc stop ' + svc + ' >nul 2>&1')
            lines.append('sc config ' + svc + ' start= disabled >nul 2>&1')
        for tp in self._WU_TASKS:
            lines.append('schtasks /change /tn "' + tp + '" /disable >nul 2>&1')
        lines.append(r'reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f >nul 2>&1')
        lines.append(r'reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoRebootWithLoggedOnUsers /t REG_DWORD /d 1 /f >nul 2>&1')
        lines.append(r'reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" /v DODownloadMode /t REG_DWORD /d 0 /f >nul 2>&1')
        lines.append('echo done > "' + flag_path + '"')
        with open(bat_path, 'w', encoding='ascii') as f:
            f.write('\r\n'.join(lines))
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", bat_path, None, None, 0)
        if ret <= 32:
            try: os.remove(bat_path)
            except Exception as e:
                self._log_error(e, "_wu_disable_elevated")
            return 'warning:uac_declined'
        deadline = time.time() + 60
        while time.time() < deadline:
            if os.path.exists(flag_path):
                try: os.remove(flag_path)
                except Exception as e:
                    self._log_error(e, "_wu_disable_elevated")
                try: os.remove(bat_path)
                except Exception as e:
                    self._log_error(e, "_wu_disable_elevated")
                return 'disabled'
            time.sleep(0.5)
        try: os.remove(bat_path)
        except Exception as e:
            self._log_error(e, "_wu_disable_elevated")
        return 'warning:timeout'

    def disable_windows_update(self):
        """Check WU. Neu da disable -> skip. Neu dang bat -> tat hoan toan.
        Fail (UAC declined / loi) -> warning, KHONG abort flow (write_registry + share_game van chay).
        Tra: {success: True, skipped: True} | {success: True, disabled: True} | {success: True, warning: '...'}.
        """
        try:
            # 1. Check da disable chua (conjunctive 8-layer AND).
            if self._wu_is_disabled():
                return {"success": True, "skipped": True}
            # 2. Tat WU.
            if is_admin():
                self._wu_disable_now()
            else:
                r = self._wu_disable_elevated()
                if r == 'warning:uac_declined':
                    return {"success": True,
                            "warning": "Không tắt được Windows Update (từ chối UAC). Vẫn tiếp tục truy cập game."}
                if r == 'warning:timeout':
                    return {"success": True,
                            "warning": "Không tắt được Windows Update (timeout). Vẫn tiếp tục truy cập game."}
            # 3. Re-check sau disable.
            if self._wu_is_disabled():
                return {"success": True, "disabled": True}
            return {"success": True,
                    "warning": "Không tắt được Windows Update hoàn toàn. Vẫn tiếp tục truy cập game."}
        except Exception as e:
            self._log_error(e, "disable_windows_update")
            # Fail -> warning, KHONG abort flow.
            return {"success": True,
                    "warning": "Lỗi tắt Windows Update (" + str(e) + "). Vẫn tiếp tục truy cập game."}


    def _write_steam_tickets(self, aid, appticket_hex, eticket_hex):
        """Helper: ghi AppTicket + ETicket (REG_BINARY) vao HKCU\\Software\\Valve\\Steam\\Apps\\{aid}.
        100% chuan: KEY_WOW64_64KEY de ghi dung 64-bit view (Steam 64-bit), validate hex,
        verify read-back de dam bao ghi that su. Tra dict {success, verified, ...} hoac {error}.
        Dung chung cho write_registry_tickets (auto flow) + redeem_code (manual flow).
        """
        try:
            import winreg
        except ImportError as e:
            self._log_error(e, "_write_steam_tickets")
            return {"success": False, "error": "winreg khong kha dung (chi Windows)"}
        # Validate hex: chi 0-9a-fA-F, do dai chan (moi byte = 2 hex).
        import re
        if not isinstance(appticket_hex, str) or not isinstance(eticket_hex, str):
            return {"success": False, "error": "Ticket khong phai chuoi hex"}
        if not re.fullmatch(r"[0-9a-fA-F]*", appticket_hex) or len(appticket_hex) % 2 != 0:
            return {"success": False, "error": f"AppTicket hex khong hop le (len={len(appticket_hex)})"}
        if not re.fullmatch(r"[0-9a-fA-F]*", eticket_hex) or len(eticket_hex) % 2 != 0:
            return {"success": False, "error": f"ETicket hex khong hop le (len={len(eticket_hex)})"}
        appticket_bytes = bytes.fromhex(appticket_hex)
        eticket_bytes = bytes.fromhex(eticket_hex)
        key_path = "Software\\Valve\\Steam\\Apps\\" + str(aid)
        # KEY_WOW64_64KEY: ghi vao 64-bit registry view (Steam 64-bit doc view nay),
        # khong bi WOW64 redirect sang 32-bit view (Software\\WOW6432Node).
        write_access = winreg.KEY_SET_VALUE | winreg.KEY_WOW64_64KEY
        read_access = winreg.KEY_QUERY_VALUE | winreg.KEY_WOW64_64KEY
        # 1. Tao/mo key voi quyen ghi.
        key = winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, key_path, 0, write_access)
        try:
            winreg.SetValueEx(key, "AppTicket", 0, winreg.REG_BINARY, appticket_bytes)
            winreg.SetValueEx(key, "ETicket", 0, winreg.REG_BINARY, eticket_bytes)
        finally:
            winreg.CloseKey(key)
        # 2. Verify read-back: mo lai voi KEY_READ + WOW64_64KEY, doc 2 value, so bytes.
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, read_access)
            try:
                at_back, _ = winreg.QueryValueEx(key, "AppTicket")
                et_back, _ = winreg.QueryValueEx(key, "ETicket")
            finally:
                winreg.CloseKey(key)
        except OSError as e:
            self._log_error(e, "_write_steam_tickets")
            return {"success": False, "error": f"Khong doc lai duoc registry sau ghi: {e}"}
        if at_back != appticket_bytes or et_back != eticket_bytes:
            return {"success": False,
                    "error": f"Verify mismatch: AppTicket wrote {len(appticket_bytes)} read {len(at_back)}, "
                             f"ETicket wrote {len(eticket_bytes)} read {len(et_back)}"}
        return {"success": True, "verified": True, "app_id": str(aid),
                "appticket_len": len(appticket_bytes), "eticket_len": len(eticket_bytes)}

    def write_registry_tickets(self, app_id):
        """Auto flow (UI bam 'Truy Cap'): skipped.
        AppTicket + ETicket CHỈ được ghi vao registry khi user redeem code thanh cong qua redeem_code().
        """
        return {"success": True, "skipped": True}

    def open_external(self, url):
        # Mo link ngoai (Discord, GitHub, viethoa) bang browser mac dinh cua Windows.
        # pywebview khong handle window.open() mac dinh -> phai route qua API Python.
        try:
            if not url:
                return {"success": False, "error": "URL rong"}
            # Bao dam co scheme http/https, chan javascript: / data: de tranh XSS.
            if not (str(url).startswith("http://") or str(url).startswith("https://")):
                return {"success": False, "error": "Chi cho phep http/https"}
            webbrowser.open(url)
            return {"success": True}
        except Exception as e:
            self._log_error(e, "open_external")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    # ================================================================
    # TÍCH HỢP VIỆT HÓA — CanhCutTeam + GameThuầnViệt portable
    # ================================================================
    # Frontend bấm "KÍCH HOẠT NGAY" → check_integration() (mount) → nếu chưa
    # cài → activate_integration() (download zip + extract + xóa zip) → nút
    # thành "KHỞI CHẠY" → bấm → launch_integration() (startfile exe).
    # Cấu trúc: %APPDATA%\NexusHideout\VietHoa\<folder>\<exe>
    # Mỗi tool check folder riêng, không check folder tool khác.

    def _get_integration_dir(self, tool_id):
        """Tra duong dan folder cua tool tich hop:
        %APPDATA%\\NexusHideout\\VietHoa\\<folder>. None neu tool_id khong hop le."""
        cfg = self.INTEGRATIONS.get(tool_id)
        if not cfg:
            return None
        appdata = os.getenv('APPDATA') or os.path.expanduser("~")
        return os.path.join(appdata, "NexusHideout", "VietHoa", cfg['folder'])

    def _find_integration_exe(self, tool_id):
        """Tim exe cua tool trong tool_dir (root hoac subfolder — zip co the
        extract voi wrapper folder). Tra path day du hoac None."""
        cfg = self.INTEGRATIONS.get(tool_id)
        if not cfg:
            return None
        tool_dir = self._get_integration_dir(tool_id)
        if not tool_dir or not os.path.isdir(tool_dir):
            return None
        # Check root truoc.
        root_exe = os.path.join(tool_dir, cfg['exe_name'])
        if os.path.isfile(root_exe):
            return root_exe
        # Walk subfolders.
        for dirpath, dirnames, filenames in os.walk(tool_dir):
            if cfg['exe_name'] in filenames:
                return os.path.join(dirpath, cfg['exe_name'])
        return None

    def check_integration(self, tool_id):
        """Check xem tool tich hop da duoc cai chua (exe ton tai).
        Goi luc mount UI de set trang thai nut (idle vs installed).
        Tra {"installed": bool, "exe_path": str|None, "tool_id": str}."""
        cfg = self.INTEGRATIONS.get(tool_id)
        if not cfg:
            return {"success": False, "error": f"Tool khong hop le: {tool_id}"}
        exe_path = self._find_integration_exe(tool_id)
        return {
            "installed": exe_path is not None,
            "exe_path": exe_path,
            "tool_id": tool_id,
        }

    def activate_integration(self, tool_id):
        """Kich hoat tool tich hop: download zip → extract (password) → xoa zip.
        Neu da cai → tra already_installed (frontend hien KHỞI CHẠY).
        Tra {"success": bool, "already_installed": bool, "exe_path": str,
             "error": str}."""
        cfg = self.INTEGRATIONS.get(tool_id)
        if not cfg:
            return {"success": False, "error": f"Tool khong hop le: {tool_id}"}
        # Fast path: da cai → tra already_installed (khong download lai).
        exe_path = self._find_integration_exe(tool_id)
        if exe_path:
            return {"success": True, "already_installed": True, "exe_path": exe_path}
        # Chua co → download + extract + xoa zip.
        tool_dir = self._get_integration_dir(tool_id)
        try:
            # Tao folder VietHoa\\<folder> neu chua co.
            os.makedirs(tool_dir, exist_ok=True)
            # Ensure portable tools (aria2c + 7za) da bootstrap.
            self._ensure_portable_tools()
            # Download zip vao NexusHideout ROOT (KHONG vao tool_dir) —
            # vi _extract_zip co shutil.rmtree(extract_dir) o dau, neu extract_dir
            # = tool_dir thi no se xoa luong zip vua download!
            # Pattern giong install_nexust/share_game: download → hidden_dir,
            # extract → tool_dir.
            hidden_dir = self._prepare_hideout()
            zip_path = self._download_zip(hidden_dir, cfg['zip_name'], cfg['file_id'])
            # Extract zip vao tool_dir voi password (7za AES native).
            # _extract_zip se rmtree(tool_dir) roi extract vao — OK vi zip
            # nam o hidden_dir, khong o tool_dir.
            self._extract_zip(zip_path, tool_dir, cfg['zip_pw'])
            # Xoa zip sau khi extract thanh cong (zip nam o hidden_dir).
            try:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
            except Exception as e:
                self._log_error(e, "activate_integration.delete_zip")
            # Verify exe ton tai (root hoac subfolder).
            exe_path = self._find_integration_exe(tool_id)
            if exe_path:
                return {"success": True, "already_installed": False, "exe_path": exe_path}
            return {"success": False,
                    "error": f"Giai nen xong nhung khong tim thay {cfg['exe_name']}"}
        except Exception as e:
            self._log_error(e, "activate_integration")
            return {"success": False, "error": str(e)}

    def launch_integration(self, tool_id):
        """Khoi chuong exe cua tool tich hop. Goi khi user bam KHỞI CHẠY.
        Tra {"success": bool, "exe_path": str, "error": str}."""
        cfg = self.INTEGRATIONS.get(tool_id)
        if not cfg:
            return {"success": False, "error": f"Tool khong hop le: {tool_id}"}
        exe_path = self._find_integration_exe(tool_id)
        if not exe_path:
            return {"success": False,
                    "error": f"Chua cai dat {cfg['exe_name']}. Hay Kich Hoat truoc."}
        try:
            # Launch exe voi cwd = exe dir (relative paths trong exe se work).
            subprocess.Popen([exe_path], cwd=os.path.dirname(exe_path),
                             creationflags=0x08000000)  # CREATE_NO_WINDOW
            return {"success": True, "exe_path": exe_path}
        except Exception as e:
            self._log_error(e, "launch_integration")
            return {"success": False, "error": str(e)}

    # ====================================================================
    # Fluenty UI (Millennium Steam skin) — cài vào Steam root folder.
    # Flow: check_steam → kill steam → download Steam.zip → extract (password)
    #       → move toàn bộ file/folder vào steam_path → xóa zip → relaunch steam.
    # Uninstall: kill steam → xóa Millennium/ + wsock32.dll trong steam_path.
    # ====================================================================

    def check_fluenty_installed(self):
        """Kiem tra Fluenty UI da cai chua (read-only).
        Check {steam_path}\\millennium\\themes\\fluenty ton tai (folder) —
        day la marker chinh xac nhat (zip chua Millennium/themes/fluenty + wsock32.dll).
        Tra {installed: bool, steam_installed: bool}."""
        try:
            steam_path = self._get_steam_install_path()
            if not steam_path or not os.path.isdir(steam_path):
                return {"installed": False, "steam_installed": False}
            theme_dir = os.path.join(steam_path, self.FLUENTY_THEME_REL)
            installed = os.path.isdir(theme_dir)
            return {"installed": bool(installed), "steam_installed": True}
        except Exception as e:
            self._log_error(e, "check_fluenty_installed")
            return {"installed": False, "steam_installed": False, "error": str(e)}

    def install_fluenty(self):
        """Cài Fluenty UI (Millennium Steam skin):
        1. Check Steam path (registry) — chua cai Steam → báo lỗi.
        2. Kill Steam hoàn toàn (file DLL wsock32.dll bị lock nếu Steam đang chạy).
        3. Download Steam.zip (Google Drive, aria2c 16 conns).
        4. Extract (7za + password) ra extract_dir.
        5. Move TOÀN BỘ file/folder (Millennium/ + wsock32.dll) vào steam_path.
           Ghi vào Program Files → fallback UAC robocopy.
        6. Xóa zip thừa.
        7. Relaunch steam.exe.
        Tra {success: bool, already: bool, error: str}."""
        try:
            steam_path = self._get_steam_install_path()
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False,
                        "error": "Không tìm thấy thư mục Steam. Vui lòng cài đặt Steam trước."}
            # Idempotent: da cai → skip download (van tra success).
            chk = self.check_fluenty_installed()
            if chk.get("installed"):
                return {"success": True, "already": True}
            # Tat Steam (wsock32.dll lock → move fail). Dung _kill_steam co san.
            self._kill_steam()
            # Ensure portable tools (aria2c + 7za) da bootstrap.
            self._ensure_portable_tools()
            hidden_dir = self._prepare_hideout()
            try:
                zip_path = self._download_zip(
                    hidden_dir, self.FLUENTY_ZIP_NAME, self.FLUENTY_FILE_ID)
                extract_dir = os.path.join(hidden_dir, "extracted_files")
                self._extract_zip(zip_path, extract_dir, self.FLUENTY_ZIP_PW)
                # Xoa zip sau khi giai nen xong.
                try:
                    if os.path.exists(zip_path):
                        os.remove(zip_path)
                except Exception as e:
                    self._log_error(e, "install_fluenty.delete_zip")
                # Move TOÀN BỘ file/folder vao steam_path (replace).
                # Neu PermissionError (Steam o Program Files) → fallback UAC robocopy.
                try:
                    self._merge_and_replace_all(extract_dir, steam_path)
                except PermissionError as e:
                    self._log_error(e, "install_fluenty.merge")
                    ok = self._elevated_merge(extract_dir, steam_path)
                    if not ok:
                        return {"success": False,
                                "error": "Cần cấp quyền Administrator (UAC) để ghi vào thư mục Steam. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
            finally:
                # Luon cleanup NexusHideout du thanh cong hay fail.
                self._cleanup_hideout(hidden_dir)
            # Relaunch Steam (non-blocking).
            self._launch_steam(steam_path)
            return {"success": True, "already": False}
        except Exception as e:
            self._log_error(e, "install_fluenty")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    def uninstall_fluenty(self):
        """Gỡ Fluenty UI (Millennium Steam skin):
        1. Check Steam path — chua cai Steam → báo lỗi.
        2. Kill Steam hoàn toàn (file wsock32.dll lock).
        3. Xóa folder Millennium/ + file wsock32.dll trong steam_path.
        4. Relaunch steam.exe.
        Tra {success: bool, error: str}.
        Robocopy rmdir fallback cho UAC neu xóa tay bi PermissionError."""
        try:
            steam_path = self._get_steam_install_path()
            if not steam_path or not os.path.isdir(steam_path):
                return {"success": False,
                        "error": "Không tìm thấy thư mục Steam."}
            # Tat Steam (wsock32.dll lock → xoa fail).
            self._kill_steam()
            millennium_dir = os.path.join(steam_path, "Millennium")
            wsock_path = os.path.join(steam_path, "wsock32.dll")
            # Xóa folder Millennium/ + file wsock32.dll.
            try:
                if os.path.isdir(millennium_dir):
                    shutil.rmtree(millennium_dir, ignore_errors=False)
            except PermissionError as e:
                # Steam o Program Files → fallback UAC rmdir.
                self._log_error(e, "uninstall_fluenty.rmdir_millennium")
                ok = self._elevated_rmdir(millennium_dir)
                if not ok:
                    return {"success": False,
                            "error": "Cần cấp quyền Administrator (UAC) để xóa thư mục Millennium. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
            try:
                if os.path.isfile(wsock_path):
                    os.remove(wsock_path)
            except PermissionError as e:
                # Fallback UAC del single file.
                self._log_error(e, "uninstall_fluenty.remove_wsock")
                # _elevated_copy_single copy vao dst_dir — o day can xoa.
                # Dung _elevated_rmdir cho file (rmdir = del /q).
                ok = self._elevated_delete_file(wsock_path)
                if not ok:
                    return {"success": False,
                            "error": "Cần cấp quyền Administrator (UAC) để xóa wsock32.dll. Vui lòng bấm Yes khi hộp thoại UAC xuất hiện."}
            # Relaunch Steam.
            self._launch_steam(steam_path)
            return {"success": True, "error": None}
        except Exception as e:
            self._log_error(e, "uninstall_fluenty")
            return {"success": False, "error": f"{type(e).__name__}: {str(e)}"}

    def _elevated_rmdir(self, target_path):
        """Spawn admin .bat de xoa folder (robocopy rmdir hoac rd /s /q).
        Tra True neu thanh cong."""
        import ctypes
        import time
        temp_dir = os.getenv('TEMP', os.path.expanduser('~'))
        flag_path = os.path.join(temp_dir, "_nx_rmdir_done.flag")
        bat_path = os.path.join(temp_dir, "_nx_rmdir.bat")
        try:
            if os.path.exists(flag_path): os.remove(flag_path)
        except Exception as e:
            self._log_error(e, "_elevated_rmdir")
            pass
        with open(bat_path, "w") as f:
            f.write('@echo off\n')
            f.write(f'if exist "{target_path}" rd /s /q "{target_path}" >nul 2>&1\n')
            f.write(f'echo %errorlevel% > "{flag_path}"\n')
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", bat_path, None, None, 0)
        if ret <= 32:
            try: os.remove(bat_path)
            except Exception: pass
            return False
        deadline = time.time() + 120
        while time.time() < deadline:
            if os.path.exists(flag_path):
                try:
                    with open(flag_path) as ff:
                        code = int(ff.read().strip())
                    os.remove(flag_path)
                    # rd /s /q: 0 = ok (xoa xong hoac khong ton tai).
                    ok = (code == 0)
                except Exception as e:
                    self._log_error(e, "_elevated_rmdir.read_flag")
                    ok = False
                try: os.remove(bat_path)
                except Exception: pass
                return ok
            time.sleep(0.5)
        try: os.remove(bat_path)
        except Exception: pass
        return False

    def _elevated_delete_file(self, file_path):
        """Spawn admin .bat de xoa 1 file (del /f /q).
        Tra True neu thanh cong (file khong con ton tai)."""
        import ctypes
        import time
        temp_dir = os.getenv('TEMP', os.path.expanduser('~'))
        flag_path = os.path.join(temp_dir, "_nx_delfile_done.flag")
        bat_path = os.path.join(temp_dir, "_nx_delfile.bat")
        try:
            if os.path.exists(flag_path): os.remove(flag_path)
        except Exception as e:
            self._log_error(e, "_elevated_delete_file")
            pass
        with open(bat_path, "w") as f:
            f.write('@echo off\n')
            f.write(f'if exist "{file_path}" del /f /q "{file_path}" >nul 2>&1\n')
            f.write(f'echo %errorlevel% > "{flag_path}"\n')
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", bat_path, None, None, 0)
        if ret <= 32:
            try: os.remove(bat_path)
            except Exception: pass
            return False
        deadline = time.time() + 60
        while time.time() < deadline:
            if os.path.exists(flag_path):
                try:
                    with open(flag_path) as ff:
                        code = int(ff.read().strip())
                    os.remove(flag_path)
                    ok = (code == 0)
                except Exception as e:
                    self._log_error(e, "_elevated_delete_file.read_flag")
                    ok = False
                try: os.remove(bat_path)
                except Exception: pass
                return ok
            time.sleep(0.5)
        try: os.remove(bat_path)
        except Exception: pass
        return False

    # ====================================================================
    # Custom install flow (Buzzheavier download → 7z extract → registry → 3 nút).
    # Multi-game: config trong self.CUSTOM_GAMES dict (key = AppID string).
    # Methods nhan app_id param, state keyed by app_id (2 game chay doc lap).
    # ====================================================================

    def _get_buzz_file_size(self, url):
        """Lay dung luong file Buzzheavier bang Range request (bytes=0-0).
        Parse Content-Range: bytes 0-0/TOTAL → tra int bytes.
        Buzzheavier KHONG can token/cookie — urllib thuong."""
        try:
            import requests
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0 Safari/537.36",
                "Range": "bytes=0-0",
            }
            r = requests.get(url, headers=headers, stream=True, timeout=30,
                             allow_redirects=True)
            cr = r.headers.get("Content-Range", "")
            # Format: "bytes 0-0/TOTAL"
            if "/" in cr:
                total = int(cr.rsplit("/", 1)[-1])
                r.close()
                return total
            # Fallback: dung Content-Length (chi dung khi server tra ve toan bo)
            cl = r.headers.get("Content-Length")
            r.close()
            if cl:
                return int(cl)
            raise Exception("Khong lay duoc dung luong file tu Buzzheavier "
                            "(khong co Content-Range)")
        except Exception as e:
            self._log_error(e, "_get_buzz_file_size")
            raise

    def _custom_cfg(self, app_id):
        """Tra config dict cho game custom (key = AppID string).
        Raise Exception neu app_id khong trong CUSTOM_GAMES."""
        cfg = self.CUSTOM_GAMES.get(str(app_id))
        if not cfg:
            raise Exception(f"Game AppID {app_id} khong co trong CUSTOM_GAMES")
        return cfg

    def check_custom_install(self, app_id):
        """Check xem game custom da cai chua.
        Doc registry HKCU <reg_key>\\InstallPath, verify exe ton tai.
        Tra {"installed": bool, "install_path": str|None}."""
        cfg = self._custom_cfg(app_id)
        try:
            import winreg
            access = winreg.KEY_QUERY_VALUE | winreg.KEY_WOW64_64KEY
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, cfg['reg_key'],
                                0, access) as key:
                install_path, _ = winreg.QueryValueEx(key, "InstallPath")
        except OSError:
            return {"installed": False, "install_path": None}
        except Exception as e:
            self._log_error(e, "check_custom_install")
            return {"installed": False, "install_path": None}
        exe_path = os.path.join(install_path, cfg['nexusg'],
                                cfg['game_subdir'], cfg['exe'])
        if os.path.isfile(exe_path):
            return {"installed": True, "install_path": install_path}
        # Registry co path nhung exe khong ton tai → xoa registry stale.
        self.clear_custom_path(app_id)
        return {"installed": False, "install_path": None}

    def get_custom_file_size(self, app_id):
        """Lay dung luong file zip Buzzheavier. Cache per-app_id.
        Tra {"size_bytes": int, "size_gb": float}."""
        cfg = self._custom_cfg(app_id)
        if not hasattr(self, '_custom_file_size'):
            self._custom_file_size = {}
        cached = self._custom_file_size.get(str(app_id))
        if cached:
            return {"size_bytes": cached, "size_gb": round(cached / (1024**3), 2),
                    "success": True}
        last_err = None
        for attempt in range(3):
            try:
                size = self._get_buzz_file_size(cfg['download_url'])
                self._custom_file_size[str(app_id)] = size
                # Clear status error cũ (user đang retry flow mới).
                st = getattr(self, '_custom_status', {}).get(str(app_id), {})
                if st.get('state') == 'error':
                    self._custom_status[str(app_id)] = {
                        "state": "idle", "progress": None,
                        "install_path": None, "error": None}
                return {"size_bytes": size, "size_gb": round(size / (1024**3), 2),
                        "success": True}
            except Exception as e:
                last_err = e
                self._log_error(e, f"get_custom_file_size:{app_id}:attempt{attempt+1}")
                import time as _t
                _t.sleep(1.5 * (attempt + 1))  # backoff 1.5s, 3s, 4.5s
        return {"success": False, "error": str(last_err) if last_err else "unknown"}

    def get_custom_status(self, app_id):
        """Tra status hien tai cua install flow (cho frontend poll khi remount).
        State: 'downloading' | 'installing' | 'installed' | 'error' | 'idle'."""
        st = getattr(self, '_custom_status', {}).get(str(app_id))
        if not st:
            return {"state": "idle", "progress": None,
                    "install_path": None, "error": None}
        return st

    def check_custom_disk_space(self, path, required_bytes):
        """Check xem o dia co du dung luong khong.
        Yeu cau: free >= 2 * required_bytes (gấp đôi dung luong file).
        Tra {"free_bytes": int, "free_gb": float, "required_gb": float,
             "required_total_gb": float, "enough": bool}."""
        try:
            if not os.path.exists(path):
                return {"success": False,
                        "error": f"Duong dan khong ton tai: {path}"}
            usage = shutil.disk_usage(path)
            free = usage.free
            required_total = required_bytes * 2  # gấp 2 lần
            return {
                "success": True,
                "free_bytes": free,
                "free_gb": round(free / (1024**3), 2),
                "required_gb": round(required_bytes / (1024**3), 2),
                "required_total_gb": round(required_total / (1024**3), 2),
                "required_total_bytes": required_total,
                "enough": free >= required_total,
            }
        except Exception as e:
            self._log_error(e, "check_custom_disk_space")
            return {"success": False, "error": str(e)}

    def _save_custom_path(self, app_id, path):
        """Luu install path vao HKCU registry (REG_SZ)."""
        cfg = self._custom_cfg(app_id)
        try:
            import winreg
            access = winreg.KEY_SET_VALUE | winreg.KEY_WOW64_64KEY
            key = winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER,
                                     cfg['reg_key'], 0, access)
            try:
                winreg.SetValueEx(key, "InstallPath", 0, winreg.REG_SZ, path)
            finally:
                winreg.CloseKey(key)
            return True
        except Exception as e:
            self._log_error(e, "_save_custom_path")
            return False

    def clear_custom_path(self, app_id):
        """Xoa registry key custom game (khi user go cai dat hoac stale path)."""
        cfg = self._custom_cfg(app_id)
        try:
            import winreg
            access = winreg.KEY_SET_VALUE | winreg.KEY_WOW64_64KEY
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, cfg['reg_key'])
        except OSError:
            pass  # Key khong ton tai → khong can lam gi.
        except Exception as e:
            self._log_error(e, "clear_custom_path")

    def open_folder_dialog(self):
        """Mo folder picker dialog (webview native).
        Tra path string hoac None (user cancel)."""
        try:
            import webview
            if not webview.windows:
                return None
            result = webview.windows[0].create_file_dialog(
                webview.FOLDER_DIALOG
            )
            if result:
                # create_file_dialog tra list (hoac tuple) → lay phan tu dau.
                if isinstance(result, (list, tuple)):
                    return result[0] if result else None
                return result
            return None
        except Exception as e:
            self._log_error(e, "open_folder_dialog")
            return None

    def _download_custom_progress(self, app_id, dest_dir, zip_name, download_url):
        """Download aria2c voi progress real-time (subprocess.Popen + parse stdout).
        Push progress vao JS qua self._window.evaluate_js(
            'window.__customProgress(appId, data)').
        Tra zip_path hoac raise Exception."""
        aria2c = self._get_aria2_portable()
        if not aria2c:
            raise Exception("Thieu aria2c.exe portable")
        zip_path = os.path.join(dest_dir, zip_name)
        # Xoa file cu + .aria2 control.
        try:
            if os.path.exists(zip_path):
                os.remove(zip_path)
            ctrl = zip_path + ".aria2"
            if os.path.exists(ctrl):
                os.remove(ctrl)
        except Exception:
            pass
        cmd = [aria2c,
               '-x16', '-s16', '-k1M', '-c',
               '-d', dest_dir,
               '-o', zip_name,
               '--retry-wait=2', '-m5',
               '--file-allocation=none',
               '--console-log-level=notice',
               '--summary-interval=1',
               '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
               'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
               download_url]
        import re as _re
        if not hasattr(self, '_custom_status'):
            self._custom_status = {}
        # Cache status cho frontend poll (khi user back+quay lại, GUI đọc lại progress).
        self._custom_status[str(app_id)] = {"state": "downloading",
                                            "progress": {"percent": 0.0, "downloaded": 0,
                                                         "total": 0},
                                            "install_path": dest_dir, "error": None}
        try:
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                creationflags=0x08000000,  # CREATE_NO_WINDOW
                text=True, encoding="utf-8", errors="replace",
                bufsize=1,
            )
            # Parse output line-by-line. Format aria2c:
            # "[#1 <zip_name> 50MiB/100MiB (50%) DL:5MiB/s]"
            progress_re = _re.compile(
                r'(\d+(?:\.\d+)?)([KMGTP]?i?B)\s*/\s*(\d+(?:\.\d+)?)([KMGTP]?i?B)\s*\((\d+(?:\.\d+)?)%\)'
            )
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                m = progress_re.search(line)
                if m and hasattr(self, '_window') and self._window:
                    dl_val = float(m.group(1))
                    dl_unit = m.group(2)
                    total_val = float(m.group(3))
                    total_unit = m.group(4)
                    pct = float(m.group(5))
                    # Chuyen sang bytes de frontend hien thi.
                    dl_bytes = int(dl_val * self._unit_multiplier(dl_unit))
                    total_bytes = int(total_val * self._unit_multiplier(total_unit))
                    # Update cache status (cho frontend poll khi remount).
                    self._custom_status[str(app_id)] = {
                        "state": "downloading",
                        "progress": {"percent": pct, "downloaded": dl_bytes,
                                     "total": total_bytes},
                        "install_path": dest_dir, "error": None,
                    }
                    js = (f"window.__customProgress && window.__customProgress("
                          f"'{app_id}',"
                          f"{{percent:{pct:.1f},downloaded:{dl_bytes},"
                          f"total:{total_bytes}}})")
                    try:
                        self._window.evaluate_js(js)
                    except Exception:
                        pass
            proc.wait(timeout=3600)
        except subprocess.TimeoutExpired:
            proc.kill()
            raise Exception("aria2c download timeout (60 phut)")
        except Exception as e:
            self._log_error(e, "_download_custom_progress")
            raise
        if proc.returncode != 0:
            raise Exception(f"aria2c download fail (code {proc.returncode})")
        if not os.path.exists(zip_path) or os.path.getsize(zip_path) == 0:
            raise Exception("aria2c tai ve rong hoac missing")
        return zip_path

    @staticmethod
    def _unit_multiplier(unit):
        """Chuyen aria2c unit (KiB/MiB/GiB/TiB/B) sang bytes multiplier."""
        units = {'B': 1, 'KiB': 1024, 'MiB': 1024**2,
                 'GiB': 1024**3, 'TiB': 1024**4, 'PiB': 1024**5,
                 'K': 1000, 'M': 1000**2, 'G': 1000**3, 'T': 1000**4,
                 'KB': 1000, 'MB': 1000**2, 'GB': 1000**3, 'TB': 1000**4}
        return units.get(unit, 1)

    def install_custom_game(self, app_id, install_path):
        """Full install flow cho game custom:
        1. Lay file size tu Buzzheavier
        2. Check disk space (free >= 2 * size)
        3. aria2c download zip → install_path\\<zip_name> (voi progress)
        4. Tao folder install_path\\<nexusg>
        5. 7z extract zip → NexusG folder
        6. Xoa zip
        7. Luu path vao registry
        Tra {"success": bool, "error": str|None}."""
        cfg = self._custom_cfg(app_id)
        if not hasattr(self, '_custom_status'):
            self._custom_status = {}
        self._custom_status[str(app_id)] = {"state": "downloading", "progress": None,
                                           "install_path": install_path, "error": None}
        try:
            # 1. Lay dung luong file.
            size_info = self.get_custom_file_size(app_id)
            if not size_info.get("success"):
                self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                    "install_path": install_path,
                                                    "error": "Khong lay duoc dung luong file"}
                return {"success": False,
                        "error": f"Khong lay duoc dung luong file: "
                                 f"{size_info.get('error', 'unknown')}"}
            file_size = size_info["size_bytes"]
            # 2. Check disk space (gấp 2 lần).
            space = self.check_custom_disk_space(install_path, file_size)
            if not space.get("success"):
                self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                    "install_path": install_path,
                                                    "error": "Khong check duoc disk space"}
                return {"success": False,
                        "error": space.get("error", "Khong check duoc disk space")}
            if not space["enough"]:
                self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                    "install_path": install_path,
                                                    "error": "Không Đủ Dung Lượng Hệ Thống"}
                return {"success": False,
                        "error": "Không Đủ Dung Lượng Hệ Thống"}
            # 3. Download aria2c (voi progress). _custom_status duoc update real-time.
            try:
                os.makedirs(install_path, exist_ok=True)
            except Exception as e:
                self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                    "install_path": install_path,
                                                    "error": f"Khong tao duoc folder: {e}"}
                return {"success": False,
                        "error": f"Khong tao duoc folder: {e}"}
            zip_path = self._download_custom_progress(
                app_id, install_path, cfg['zip_name'], cfg['download_url']
            )
            # 4. Tao folder NexusG + 5. 7z extract → installing state.
            self._custom_status[str(app_id)] = {"state": "installing", "progress": None,
                                                "install_path": install_path, "error": None}
            nexusg_dir = os.path.join(install_path, cfg['nexusg'])
            os.makedirs(nexusg_dir, exist_ok=True)
            # 5. 7z extract zip → NexusG folder.
            try:
                self._extract_zip(zip_path, nexusg_dir, cfg['zip_pw'])
            except Exception as e:
                self._log_error(e, "install_custom_game:extract")
                self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                    "install_path": install_path,
                                                    "error": f"Giai nen that bai: {e}"}
                return {"success": False,
                        "error": f"Giai nen that bai: {e}"}
            # 6. Xoa zip file (chi xoa zip, giu nguyen file da extract).
            try:
                if os.path.exists(zip_path):
                    os.remove(zip_path)
            except Exception:
                pass  # Khong critical neu khong xoa duoc.
            # 7. Verify exe ton tai (extract thanh cong).
            exe_path = os.path.join(nexusg_dir, cfg['game_subdir'], cfg['exe'])
            if not os.path.isfile(exe_path):
                self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                    "install_path": install_path,
                                                    "error": f"Khong tim thay {cfg['exe']} sau extract"}
                return {"success": False,
                        "error": f"Giai nen xong nhung khong tim thay {cfg['exe']}"}
            # 8. Luu path vao registry → installed.
            self._save_custom_path(app_id, install_path)
            self._custom_status[str(app_id)] = {"state": "installed", "progress": None,
                                                "install_path": install_path, "error": None}
            return {"success": True, "error": None,
                    "install_path": install_path}
        except Exception as e:
            self._log_error(e, "install_custom_game")
            self._custom_status[str(app_id)] = {"state": "error", "progress": None,
                                                "install_path": install_path,
                                                "error": str(e)}
            return {"success": False, "error": str(e)}

    def launch_custom_game(self, app_id):
        """Khoi chay exe tu folder cai dat.
        Tra {"success": bool, "error": str|None}."""
        cfg = self._custom_cfg(app_id)
        try:
            install = self.check_custom_install(app_id)
            if not install["installed"]:
                return {"success": False,
                        "error": "Game chua cai dat. Vui long cai dat truoc."}
            exe_path = os.path.join(install["install_path"],
                                    cfg['nexusg'],
                                    cfg['game_subdir'],
                                    cfg['exe'])
            if not os.path.isfile(exe_path):
                return {"success": False,
                        "error": f"Khong tim thay exe: {exe_path}"}
            subprocess.Popen([exe_path], cwd=os.path.dirname(exe_path),
                             creationflags=0x08000000)  # CREATE_NO_WINDOW
            return {"success": True, "error": None}
        except Exception as e:
            self._log_error(e, "launch_custom_game")
            return {"success": False, "error": str(e)}

    def uninstall_custom_game(self, app_id):
        """Go cai dat: xoa folder NexusG + clear registry.
        Tra {"success": bool, "error": str|None}."""
        cfg = self._custom_cfg(app_id)
        try:
            install = self.check_custom_install(app_id)
            if not install["installed"]:
                # Co the user da xoa tay → chi clear registry (neu con).
                self.clear_custom_path(app_id)
                return {"success": True, "error": None,
                        "already_gone": True}
            install_path = install["install_path"]
            nexusg_dir = os.path.join(install_path, cfg['nexusg'])
            if os.path.exists(nexusg_dir):
                shutil.rmtree(nexusg_dir, ignore_errors=False)
            # Clear registry.
            self.clear_custom_path(app_id)
            return {"success": True, "error": None,
                    "removed_path": nexusg_dir}
        except Exception as e:
            self._log_error(e, "uninstall_custom_game")
            return {"success": False, "error": str(e)}

    def open_custom_folder(self, app_id):
        """Mo folder NexusG trong Explorer.
        Tra {"success": bool, "error": str|None}."""
        cfg = self._custom_cfg(app_id)
        try:
            install = self.check_custom_install(app_id)
            if not install["installed"]:
                return {"success": False,
                        "error": "Game chua cai dat."}
            nexusg_dir = os.path.join(install["install_path"], cfg['nexusg'])
            if not os.path.isdir(nexusg_dir):
                return {"success": False,
                        "error": f"Folder khong ton tai: {nexusg_dir}"}
            subprocess.Popen(['explorer', nexusg_dir],
                             creationflags=0x08000000)
            return {"success": True, "error": None}
        except Exception as e:
            self._log_error(e, "open_custom_folder")
            return {"success": False, "error": str(e)}


WEB_URL = 'https://nexus-launcher-gold.vercel.app/'
WIN_TITLE = 'NexusGames'

# Token bi mat: 32 ky tu hex. Webview inject vao page de unlock web (gate).
# Browser truy cap truc tiep khong co token -> lock screen.
NEXUS_TOKEN = secrets.token_hex(16)  # 32 ky tu


def set_dpi_aware():
    # Giup kich thuoc cua so dung tren man 4K / Windows scaling (125%, 150%...)
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PER_MONITOR_AWARE
    except:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except: pass


def get_workarea():
    # Lay vung lam viec (khong tinh taskbar) -> cua so can chinh theo khu vuc nay
    rect = ctypes.wintypes.RECT()
    SPI_GETWORKAREA = 0x0030
    ctypes.windll.user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(rect), 0)
    return rect.right - rect.left, rect.bottom - rect.top


def window_geometry():
    set_dpi_aware()
    try:
        w, h = get_workarea()
    except:
        w, h = 1920, 1080
    # Cua so = 87% workarea, can giua. min_size de khong nho qua.
    win_w = int(w * 0.87)
    win_h = int(h * 0.87)
    x = int((w - win_w) / 2)
    y = int((h - win_h) / 2)
    return win_w, win_h, x, y


def inject_token(window):
    # Inject token vao window cua page. Lap lai moi 150ms trong 3s de
    # chac chan duoc set ngay khi page load xong (race condition).
    js = f"window.__NEXUS_TOKEN = '{NEXUS_TOKEN}';"
    # Hook window.open -> route qua pywebview API (Python mo browser ngoai).
    # pywebview khong tu handle window.open() -> nút Discord/GitHub/Hỗ Trợ khong mo.
    js += """
        if (!window.__NEXUS_OPEN_HOOKED) {
          window.__NEXUS_OPEN_HOOKED = true;
          window.open = function(url, target, features) {
            try {
              if (window.pywebview && window.pywebview.api && window.pywebview.api.open_external) {
                window.pywebview.api.open_external(url);
              }
            } catch(e) {}
            return null;
          };
        }
    """
    for _ in range(20):
        try:
            window.evaluate_js(js)
        except:
            pass
        import time
        time.sleep(0.15)


def on_loaded(window):
    # Event 'loaded' fire khi page load xong -> bat dau inject token
    threading.Thread(target=inject_token, args=(window,), daemon=True).start()


def is_admin():
    # Kiem tra process hien tai co quyen admin khong.
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def relaunch_as_admin():
    # Relaunch process hien tai voi quyen admin (UAC prompt 1 lan).
    # Tra True neu spawn thanh cong (user bam Yes), False neu user tu choi/loi.
    try:
        if getattr(sys, 'frozen', False):
            # Frozen exe (PyInstaller) — chay luon exe, khong can script arg.
            exe = sys.executable
            params = None
        else:
            # Script — chay python.exe voi duong dan script + args.
            # Dung abspath de moi working dir van resolve duoc (UAC co the chay tu System32).
            exe = sys.executable
            script = os.path.abspath(sys.argv[0])
            params = '"' + script + '"'
            if len(sys.argv) > 1:
                params += ' ' + ' '.join('"' + a + '"' for a in sys.argv[1:])
        # lpDirectory (tham so 5) = thu muc chua script -> working dir nhat quan.
        work_dir = os.path.dirname(os.path.abspath(sys.argv[0])) if not getattr(sys, 'frozen', False) else None
        ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", exe, params, work_dir, 1)
        return ret > 32
    except Exception:
        return False


def main():
    # Tu relaunch as admin ngay tu dau -> ghi Steam folder khong can UAC tung buoc.
    # Neu user tu choi UAC -> van chay binh thuong (per-op UAC fallback o install_nexust/share_game/fix_game).
    if not is_admin():
        if relaunch_as_admin():
            sys.exit(0)  # Da spawn process admin -> thoat process non-admin nay.
        # User tu choi UAC -> tiep tuc chay non-admin, fallback UAC tung op van hoat dong.
    # [Lua cleanup] — check + xóa .lua files trong Nexus folder lúc startup (sau admin check)
    try:
        _nexus_cleanup_lua()
    except Exception:
        pass
    # [Lua cleanup] — register atexit: chạy cleanup khi process exit (Ctrl-C, sys.exit, normal shutdown)
    import atexit
    atexit.register(_nexus_cleanup_lua)
    # Co admin roi -> bootstrap portable tools (7za.exe + aria2c.exe) DONG BO truoc khi mo UI.
    # Lan dau: PURE PYTHON download+extract (requests + zipfile, ~5s). Lan sau: instant (fast path).
    # Sau bootstrap: TAT CA download = aria2c, TAT CA extract = 7za portable
    # (khong can cai 7-Zip/winrar tren may nua).
    api = NexusAPI()
    # === [Cloud Save precheck] — chay 1 lan luc startup de set UI state cho frontend doc luc mount.
    # Frontend doc api.cloud_save_precheck (dict) -> Cloud Save card hien 'ĐÃ KÍCH HOẠT' (installed=True)
    # hoac 'KÍCH HOẠT NGAY' (installed=False) ngay khi render, khong can goi API them.
    try:
        api.cloud_save_precheck = api.check_cloud_save()
    except Exception as e:
        try:
            api._log_error(e, "main.cloud_precheck")
        except Exception:
            pass
        api.cloud_save_precheck = {"installed": False, "steam_installed": False}
    # === [Fluenty UI precheck] — chay 1 lan luc startup de set UI state cho frontend.
    try:
        api.fluenty_precheck = api.check_fluenty_installed()
    except Exception as e:
        try:
            api._log_error(e, "main.fluenty_precheck")
        except Exception:
            pass
        api.fluenty_precheck = {"installed": False, "steam_installed": False}
    try:
        api._ensure_portable_tools()
    except Exception as e:
        try:
            api._log_error(e, "main.bootstrap")
        except Exception:
            pass
        # Bootstrap fail khong chan UI — khi user bam nut, _download_zip/_extract_zip
        # se raise loi ro rang "Thieu aria2c/7za portable".
    win_w, win_h, x, y = window_geometry()
    window = webview.create_window(
        WIN_TITLE,
        WEB_URL,
        width=win_w,
        height=win_h,
        x=x,
        y=y,
        min_size=(1100, 680),
        resizable=True,
        background_color='#111317',
        js_api=api,  # dung instance da bootstrap portable tools.
    )
    # E16 Revelations: luu window vao api de method co the evaluate_js (push progress).
    # Dùng _window (private) — pywebview get_functions() introspect _js_api va skip
    # thuoc tinh bat dau bang '_'. Neu dung 'window' (public) → recurse vao
    # window.native (WinForms Form) → Form.ActiveControl.Bounds.Empty.Empty...
    # → infinite recursion → "Not Responding" + crash.
    api._window = window
    window.events.loaded += lambda: on_loaded(window)
    # [Lua cleanup] — chạy cleanup khi user nhấn X (trước khi window close)
    window.events.closing += lambda: _nexus_cleanup_lua()
    
    # Thiết lập thư mục lưu trữ cache, cookies, localstorage
    appdata = os.environ.get('APPDATA')
    if appdata:
        storage_dir = os.path.join(appdata, 'NexusGamesData')
    else:
        storage_dir = os.path.expanduser('~/NexusGamesData')
        
    try:
        os.makedirs(storage_dir, exist_ok=True)
    except:
        storage_dir = None
        
    webview.start(private_mode=False, storage_path=storage_dir)


if __name__ == "__main__":
    main()
