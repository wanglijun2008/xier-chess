// 中国象棋核心逻辑
class ChineseChess {
    constructor() {
        this.board = this.initBoard();
        this.currentPlayer = 'red'; // red 或 black
        this.selectedPiece = null;
        this.moveHistory = [];
        this.round = 1;
        this.gameOver = false;
        this.winner = null;

        // 棋子定义
        this.pieces = {
            'r_king': { name: '帅', color: 'red', type: 'king' },
            'r_advisor': { name: '仕', color: 'red', type: 'advisor' },
            'r_elephant': { name: '相', color: 'red', type: 'elephant' },
            'r_horse': { name: '马', color: 'red', type: 'horse' },
            'r_rook': { name: '车', color: 'red', type: 'rook' },
            'r_cannon': { name: '炮', color: 'red', type: 'cannon' },
            'r_pawn': { name: '兵', color: 'red', type: 'pawn' },
            'b_king': { name: '将', color: 'black', type: 'king' },
            'b_advisor': { name: '士', color: 'black', type: 'advisor' },
            'b_elephant': { name: '象', color: 'black', type: 'elephant' },
            'b_horse': { name: '马', color: 'black', type: 'horse' },
            'b_rook': { name: '车', color: 'black', type: 'rook' },
            'b_cannon': { name: '炮', color: 'black', type: 'cannon' },
            'b_pawn': { name: '卒', color: 'black', type: 'pawn' }
        };
    }

    initBoard() {
        // 10行9列的棋盘，null表示空位
        const board = Array(10).fill(null).map(() => Array(9).fill(null));

        // 黑方（上方，行0-4）
        board[0][0] = 'b_rook'; board[0][8] = 'b_rook';
        board[0][1] = 'b_horse'; board[0][7] = 'b_horse';
        board[0][2] = 'b_elephant'; board[0][6] = 'b_elephant';
        board[0][3] = 'b_advisor'; board[0][5] = 'b_advisor';
        board[0][4] = 'b_king';
        board[2][1] = 'b_cannon'; board[2][7] = 'b_cannon';
        board[3][0] = 'b_pawn'; board[3][2] = 'b_pawn';
        board[3][4] = 'b_pawn'; board[3][6] = 'b_pawn'; board[3][8] = 'b_pawn';

        // 红方（下方，行5-9）
        board[9][0] = 'r_rook'; board[9][8] = 'r_rook';
        board[9][1] = 'r_horse'; board[9][7] = 'r_horse';
        board[9][2] = 'r_elephant'; board[9][6] = 'r_elephant';
        board[9][3] = 'r_advisor'; board[9][5] = 'r_advisor';
        board[9][4] = 'r_king';
        board[7][1] = 'r_cannon'; board[7][7] = 'r_cannon';
        board[6][0] = 'r_pawn'; board[6][2] = 'r_pawn';
        board[6][4] = 'r_pawn'; board[6][6] = 'r_pawn'; board[6][8] = 'r_pawn';

        return board;
    }

    // 重置游戏状态
    resetState() {
        this.gameOver = false;
        this.winner = null;
    }

    getPiece(row, col) {
        if (row < 0 || row >= 10 || col < 0 || col >= 9) return null;
        const pieceId = this.board[row][col];
        return pieceId ? this.pieces[pieceId] : null;
    }

    selectPiece(row, col) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束，请开始新局' };
        }
        const piece = this.getPiece(row, col);
        if (!piece || piece.color !== this.currentPlayer) {
            return { success: false, message: '没有可走的棋子' };
        }
        this.selectedPiece = { row, col, piece };
        return { success: true, message: this.describePiece(row, col, piece) };
    }

    movePiece(toRow, toCol) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束，请开始新局' };
        }
        if (!this.selectedPiece) {
            return { success: false, message: '请先选择棋子' };
        }

        const fromRow = this.selectedPiece.row;
        const fromCol = this.selectedPiece.col;
        const piece = this.selectedPiece.piece;

        // 检查是否合法走法
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol, piece)) {
            return { success: false, message: '不合法的走法' };
        }

        // 检查走棋后是否造成己方被将军（不允许送将）
        if (this.wouldBeInCheck(fromRow, fromCol, toRow, toCol, piece.color)) {
            return { success: false, message: '这样走会被将军，不允许' };
        }

        // 检查是否吃子
        const captured = this.getPiece(toRow, toCol);
        let message = this.describeMove(fromRow, fromCol, toRow, toCol, piece);

        // 执行移动
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        // 记录历史
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: captured
        });

        // 切换玩家
        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        if (this.currentPlayer === 'red') this.round++;

        // 清除选中状态
        this.selectedPiece = null;

        if (captured) {
            message += `，吃掉${captured.color === 'red' ? '红方' : '黑方'}${captured.name}`;
        }

        // ========== 关键修复：检查游戏结束 ==========
        // 1. 检查是否吃掉将/帅
        if (captured && captured.type === 'king') {
            this.gameOver = true;
            this.winner = piece.color;
            const winnerName = piece.color === 'red' ? '红方' : '黑方';
            message += `。${winnerName}获胜！`;
            return { success: true, message, gameOver: true, winner: piece.color };
        }

        // 2. 检查对方是否被将杀或困毙
        const opponent = this.currentPlayer;
        const opponentMoves = this.getAllMoves(opponent);
        if (opponentMoves.length === 0) {
            this.gameOver = true;
            // 如果对方被将军且无棋可走 = 将杀；否则 = 困毙
            const inCheck = this.isInCheck(opponent);
            this.winner = inCheck ? (opponent === 'red' ? 'black' : 'red') : (opponent === 'red' ? 'black' : 'red');
            const winnerName = this.winner === 'red' ? '红方' : '黑方';
            const loserName = opponent === 'red' ? '红方' : '黑方';
            if (inCheck) {
                message += `。${loserName}被将杀，${winnerName}获胜！`;
            } else {
                message += `。${loserName}无棋可走（困毙），${winnerName}获胜！`;
            }
            return { success: true, message, gameOver: true, winner: this.winner };
        }

        // 3. 检查将军
        if (this.isInCheck(opponent)) {
            message += '，将军！';
        }

        return { success: true, message };
    }

    // 检查某方走棋后是否会造成己方被将军
    wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
        const capturedId = this.board[toRow][toCol];
        const pieceId = this.board[fromRow][fromCol];
        this.board[toRow][toCol] = pieceId;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isInCheck(color);

        // 恢复
        this.board[fromRow][fromCol] = pieceId;
        this.board[toRow][toCol] = capturedId;

        return inCheck;
    }

    isValidMove(fromRow, fromCol, toRow, toCol, piece) {
        // 基本的边界检查
        if (toRow < 0 || toRow >= 10 || toCol < 0 || toCol >= 9) return false;

        // 不能吃自己的棋子
        const target = this.getPiece(toRow, toCol);
        if (target && target.color === piece.color) return false;

        // 根据棋子类型检查走法
        switch (piece.type) {
            case 'king':
                return this.isValidKingMove(fromRow, fromCol, toRow, toCol, piece);
            case 'advisor':
                return this.isValidAdvisorMove(fromRow, fromCol, toRow, toCol, piece);
            case 'elephant':
                return this.isValidElephantMove(fromRow, fromCol, toRow, toCol, piece);
            case 'horse':
                return this.isValidHorseMove(fromRow, fromCol, toRow, toCol, piece);
            case 'rook':
                return this.isValidRookMove(fromRow, fromCol, toRow, toCol, piece);
            case 'cannon':
                return this.isValidCannonMove(fromRow, fromCol, toRow, toCol, piece);
            case 'pawn':
                return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, piece);
        }
        return false;
    }

    isValidKingMove(fromRow, fromCol, toRow, toCol, piece) {
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);

        // 九宫内一步直行
        if (dr + dc === 1) {
            if (piece.color === 'red') {
                return toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5;
            } else {
                return toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
            }
        }

        // ========== 飞将规则：两将对面 ==========
        // 将可以在同一列上直接吃掉对方的将（中间无子）
        if (fromCol === toCol && dc === 0) {
            const opponentKingName = piece.color === 'red' ? '将' : '帅';
            // 检查目标位置是否是对方将/帅
            const targetPiece = this.getPiece(toRow, toCol);
            if (targetPiece && targetPiece.name === opponentKingName) {
                // 检查中间是否有棋子
                const minRow = Math.min(fromRow, toRow);
                const maxRow = Math.max(fromRow, toRow);
                for (let r = minRow + 1; r < maxRow; r++) {
                    if (this.getPiece(r, fromCol)) return false;
                }
                return true; // 飞将合法
            }
        }

        return false;
    }

    isValidAdvisorMove(fromRow, fromCol, toRow, toCol, piece) {
        // 九宫内一步斜行
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);
        if (dr !== 1 || dc !== 1) return false;

        if (piece.color === 'red') {
            return toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5;
        } else {
            return toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
        }
    }

    isValidElephantMove(fromRow, fromCol, toRow, toCol, piece) {
        // 走田字，不能过河
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);
        if (dr !== 2 || dc !== 2) return false;

        // 检查象眼
        const eyeRow = (fromRow + toRow) / 2;
        const eyeCol = (fromCol + toCol) / 2;
        if (this.getPiece(eyeRow, eyeCol)) return false;

        // 检查是否过河
        if (piece.color === 'red') {
            return toRow >= 5;
        } else {
            return toRow <= 4;
        }
    }

    isValidHorseMove(fromRow, fromCol, toRow, toCol, piece) {
        // 走日字
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);
        if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) return false;

        // 检查马腿
        if (dr === 2) {
            const legRow = fromRow + (toRow - fromRow) / 2;
            if (this.getPiece(legRow, fromCol)) return false;
        } else {
            const legCol = fromCol + (toCol - fromCol) / 2;
            if (this.getPiece(fromRow, legCol)) return false;
        }

        return true;
    }

    isValidRookMove(fromRow, fromCol, toRow, toCol, piece) {
        // 直线移动，不能越子
        if (fromRow !== toRow && fromCol !== toCol) return false;

        if (fromRow === toRow) {
            const step = toCol > fromCol ? 1 : -1;
            for (let c = fromCol + step; c !== toCol; c += step) {
                if (this.getPiece(fromRow, c)) return false;
            }
        } else {
            const step = toRow > fromRow ? 1 : -1;
            for (let r = fromRow + step; r !== toRow; r += step) {
                if (this.getPiece(r, fromCol)) return false;
            }
        }

        return true;
    }

    isValidCannonMove(fromRow, fromCol, toRow, toCol, piece) {
        // 移动同车，吃子需隔一子
        if (fromRow !== toRow && fromCol !== toCol) return false;

        let count = 0;
        if (fromRow === toRow) {
            const step = toCol > fromCol ? 1 : -1;
            for (let c = fromCol + step; c !== toCol; c += step) {
                if (this.getPiece(fromRow, c)) count++;
            }
        } else {
            const step = toRow > fromRow ? 1 : -1;
            for (let r = fromRow + step; r !== toRow; r += step) {
                if (this.getPiece(r, fromCol)) count++;
            }
        }

        const target = this.getPiece(toRow, toCol);
        if (target) {
            return count === 1; // 吃子必须隔一子
        } else {
            return count === 0; // 移动不能越子
        }
    }

    isValidPawnMove(fromRow, fromCol, toRow, toCol, piece) {
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;

        if (piece.color === 'red') {
            // 红方向上走
            if (fromRow >= 5) {
                // 未过河，只能前进
                return dr === -1 && dc === 0;
            } else {
                // 已过河，可前进或左右
                return (dr === -1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1);
            }
        } else {
            // 黑方向下走
            if (fromRow <= 4) {
                // 未过河，只能前进
                return dr === 1 && dc === 0;
            } else {
                // 已过河，可前进或左右
                return (dr === 1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1);
            }
        }
    }

    undo() {
        if (this.moveHistory.length === 0) {
            return { success: false, message: '没有可悔的棋' };
        }

        const lastMove = this.moveHistory.pop();
        this.board[lastMove.from.row][lastMove.from.col] =
            this.board[lastMove.to.row][lastMove.to.col];
        this.board[lastMove.to.row][lastMove.to.col] =
            lastMove.captured ? this.getPieceId(lastMove.captured) : null;

        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        if (this.currentPlayer === 'black') this.round--;

        // 悔棋时重置游戏结束状态
        this.gameOver = false;
        this.winner = null;

        return { success: true, message: '已悔棋' };
    }

    getPieceId(piece) {
        for (const [id, p] of Object.entries(this.pieces)) {
            if (p.name === piece.name && p.color === piece.color) return id;
        }
        return null;
    }

    // ========== 统一坐标系：每方以自己的右下角为基准 ==========
    // 列：1-9（从自己的右向左），行：0-9（从自己向对方）
    // 红方在棋盘下方：内部(行9,列8)=红方右下角 → 用户(行0,列1)
    // 黑方在棋盘上方：内部(行0,列0)=黑方右下角 → 用户(行0,列1)
    // 内部坐标 → 用户坐标
    internalToUserCol(col, color) { return color === 'red' ? 9 - col : col + 1; }
    internalToUserRow(row, color) { return color === 'red' ? 9 - row : row; }
    // 用户坐标 → 内部坐标
    userToInternalCol(uCol, color) { return color === 'red' ? 9 - uCol : uCol - 1; }
    userToInternalRow(uRow, color) { return color === 'red' ? 9 - uRow : uRow; }

    describePiece(row, col, piece) {
        const uCol = this.internalToUserCol(col, piece.color);
        const uRow = this.internalToUserRow(row, piece.color);
        return `${piece.color === 'red' ? '红方' : '黑方'}${piece.name}，第${uCol}列第${uRow}行`;
    }

    describeMove(fromRow, fromCol, toRow, toCol, piece) {
        const color = piece.color;
        const uFromCol = this.internalToUserCol(fromCol, color);
        const uToCol = this.internalToUserCol(toCol, color);

        let action = '';
        const isForward = (color === 'red' && toRow < fromRow) ||
                          (color === 'black' && toRow > fromRow);
        if (fromRow === toRow) {
            action = '平';
        } else if (isForward) {
            action = '进';
        } else {
            action = '退';
        }

        let target;
        if (action === '平') {
            target = uToCol;
        } else if (piece.type === 'rook' || piece.type === 'cannon' || piece.type === 'king') {
            // 直线棋子：进/退N步
            target = Math.abs(toRow - fromRow);
        } else {
            // 斜线/日字棋子：进/退到第N列
            target = uToCol;
        }

        return `${piece.name}${uFromCol}${action}${target}`;
    }

    // ========== 统一坐标系：扫描全部棋盘（各用己方坐标播报） ==========
    describeBoard() {
        let desc = `${this.currentPlayer === 'red' ? '红方' : '黑方'}走棋。第${this.round}回合。`;

        desc += '红方：';
        let redPieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === 'red') {
                    redPieces.push(`${piece.name}${this.internalToUserCol(c, 'red')}${this.internalToUserRow(r, 'red')}`);
                }
            }
        }
        desc += redPieces.length > 0 ? redPieces.join('，') + '。' : '无棋子。';

        desc += '黑方：';
        let blackPieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === 'black') {
                    blackPieces.push(`${piece.name}${this.internalToUserCol(c, 'black')}${this.internalToUserRow(r, 'black')}`);
                }
            }
        }
        desc += blackPieces.length > 0 ? blackPieces.join('，') + '。' : '无棋子。';

        return desc;
    }

    // ========== 统一坐标系棋谱解析（语音与文字输入共用） ==========
    // 格式：炮2平5 / 炮二平五 / 马8进7 / 前车2进3
    // 列1-9从自己的右向左，行0-9从自己向对方，双方各以自己右下角为基准

    // 规范化输入文本：全角转半角、中文数字转阿拉伯数字、同音字纠正、去标点空格
    normalizeCommandText(text) {
        if (!text) return '';
        let t = String(text);
        t = t.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
        const cnNums = { '零': '0', '〇': '0', '一': '1', '二': '2', '两': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
        t = t.replace(/[零〇一二两三四五六七八九]/g, ch => cnNums[ch]);
        // 语音识别常见同音字（相/象、仕/士等互通由 isSamePieceName 处理）
        t = t.replace(/跑/g, '炮').replace(/像/g, '象');
        t = t.replace(/[，。、,.！!？?；;:：\u2018\u2019\u201C\u201D'"（）()\s]/g, '');
        return t.trim();
    }

    // 棋子名别名组：帅/将、仕/士、相/象、兵/卒 互相通用
    isSamePieceName(a, b) {
        if (a === b) return true;
        const groups = [['帅', '将'], ['仕', '士'], ['相', '象'], ['兵', '卒']];
        return groups.some(g => g.indexOf(a) >= 0 && g.indexOf(b) >= 0);
    }

    parseVoiceCommand(text) {
        text = this.normalizeCommandText(text);
        if (!text) return null;

        const pieceNames = ['帅', '将', '仕', '士', '相', '象', '马', '车', '炮', '兵', '卒'];

        // 可选的前/中/后限定（同列多个相同棋子时使用，如"前车2进3"）
        let qualifier = null;
        if (/^[前后中]/.test(text)) {
            qualifier = text[0];
            text = text.substring(1);
        }

        // 提取棋子名
        let pieceName = null;
        for (const pn of pieceNames) {
            if (text.startsWith(pn)) { pieceName = pn; break; }
        }
        if (!pieceName) return null;

        // 提取起始列（数字1-9）
        let rest = text.substring(pieceName.length);
        const colMatch = rest.match(/^([1-9])/);
        if (!colMatch) return null;
        const fromUserCol = parseInt(colMatch[1], 10);

        // 提取动作
        rest = rest.substring(1);
        const actionMatch = rest.match(/^([进退平])/);
        if (!actionMatch) return null;
        const action = actionMatch[1];

        // 提取目标数字（第一位，忽略其余尾缀）
        const targetStr = rest.substring(1);
        if (!/^[0-9]/.test(targetStr)) return null;

        return { pieceName, fromUserCol, action, target: targetStr[0], qualifier };
    }

    // 解析棋谱目标位置
    // 返回 { fromRow, fromCol, toRow, toCol }；歧义返回 { ambiguous: true }；无法解析返回 null
    resolveVoiceMove(cmd) {
        if (!cmd) return null;
        const color = this.currentPlayer;
        const fromCol = this.userToInternalCol(cmd.fromUserCol, color);
        if (fromCol < 0 || fromCol > 8) return null;

        // 找到当前方在该列的所有同名棋子（可能多个，如双车同列、叠兵）
        const candidates = [];
        for (let r = 0; r < 10; r++) {
            const p = this.getPiece(r, fromCol);
            if (p && p.color === color && this.isSamePieceName(p.name, cmd.pieceName)) {
                candidates.push({ row: r, col: fromCol, piece: p });
            }
        }
        if (candidates.length === 0) return null;

        // 有前/中/后限定时直接锁定棋子
        let pool = candidates;
        if (candidates.length > 1 && cmd.qualifier) {
            // 越靠近对方越"前"：红方行号小为前，黑方行号大为前
            const sorted = candidates.slice().sort((a, b) => color === 'red' ? a.row - b.row : b.row - a.row);
            if (cmd.qualifier === '前') pool = [sorted[0]];
            else if (cmd.qualifier === '后') pool = [sorted[sorted.length - 1]];
            else pool = sorted.length >= 3 ? [sorted[1]] : [sorted[Math.floor(sorted.length / 2)]];
        }

        const targetNum = parseInt(cmd.target, 10);
        const legalMoves = [];
        for (const cand of pool) {
            const to = this.resolveTargetSquare(cand, cmd.action, targetNum, color);
            if (!to) continue;
            if (to.row < 0 || to.row >= 10 || to.col < 0 || to.col >= 9) continue;
            if (this.isValidMove(cand.row, cand.col, to.row, to.col, cand.piece) &&
                !this.wouldBeInCheck(cand.row, cand.col, to.row, to.col, color)) {
                legalMoves.push({ fromRow: cand.row, fromCol: cand.col, toRow: to.row, toCol: to.col });
            }
        }

        if (legalMoves.length === 1) return legalMoves[0];
        if (legalMoves.length > 1) return { ambiguous: true };
        return null;
    }

    // 根据动作与目标数计算目标格（内部坐标）
    resolveTargetSquare(cand, action, targetNum, color) {
        const { row, col, piece } = cand;
        if (isNaN(targetNum)) return null;
        // 前进方向：红方向上（内部行减小），黑方向下（内部行增大）
        const forward = color === 'red' ? -1 : 1;

        if (action === '平') {
            // 平：目标列
            if (targetNum < 1 || targetNum > 9) return null;
            return { row, col: this.userToInternalCol(targetNum, color) };
        }

        const dir = action === '进' ? forward : -forward;

        if (piece.type === 'rook' || piece.type === 'cannon' || piece.type === 'king') {
            // 直线棋子：进/退N步
            if (targetNum < 1 || targetNum > 9) return null;
            return { row: row + dir * targetNum, col };
        }

        if (piece.type === 'pawn') {
            // 兵/卒：只能进1步（目标数是步数），不能退；平在上面的分支处理
            if (action === '退') return null;
            if (targetNum !== 1) return null;
            return { row: row + dir, col };
        }

        // 马/相(象)/仕(士)：进/退到目标列
        if (targetNum < 1 || targetNum > 9) return null;
        const toCol = this.userToInternalCol(targetNum, color);
        const dc = Math.abs(toCol - col);
        let dr;
        if (piece.type === 'horse') {
            if (dc === 1) dr = 2;
            else if (dc === 2) dr = 1;
            else return null;
        } else if (piece.type === 'elephant') {
            if (dc !== 2) return null;
            dr = 2;
        } else { // advisor
            if (dc !== 1) return null;
            dr = 1;
        }
        return { row: row + dir * dr, col: toCol };
    }

    // ========== 功能1：AI 引擎 ==========

    // 不依赖 selectedPiece 的走棋方法
    movePieceByCoords(fromRow, fromCol, toRow, toCol) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束，请开始新局' };
        }
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) return { success: false, message: '起始位置没有棋子' };
        if (piece.color !== this.currentPlayer) return { success: false, message: '不是该方的棋子' };

        if (!this.isValidMove(fromRow, fromCol, toRow, toCol, piece)) {
            return { success: false, message: '不合法的走法' };
        }

        // 检查走棋后是否造成己方被将军
        if (this.wouldBeInCheck(fromRow, fromCol, toRow, toCol, piece.color)) {
            return { success: false, message: '这样走会被将军，不允许' };
        }

        const captured = this.getPiece(toRow, toCol);
        let message = this.describeMove(fromRow, fromCol, toRow, toCol, piece);

        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: captured
        });

        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        if (this.currentPlayer === 'red') this.round++;
        this.selectedPiece = null;

        if (captured) {
            message += `，吃掉${captured.color === 'red' ? '红方' : '黑方'}${captured.name}`;
        }

        // ========== 检查游戏结束 ==========
        if (captured && captured.type === 'king') {
            this.gameOver = true;
            this.winner = piece.color;
            const winnerName = piece.color === 'red' ? '红方' : '黑方';
            message += `。${winnerName}获胜！`;
            return { success: true, message, gameOver: true, winner: piece.color };
        }

        const opponent = this.currentPlayer;
        const opponentMoves = this.getAllMoves(opponent);
        if (opponentMoves.length === 0) {
            this.gameOver = true;
            const inCheck = this.isInCheck(opponent);
            this.winner = inCheck ? (opponent === 'red' ? 'black' : 'red') : (opponent === 'red' ? 'black' : 'red');
            const winnerName = this.winner === 'red' ? '红方' : '黑方';
            const loserName = opponent === 'red' ? '红方' : '黑方';
            if (inCheck) {
                message += `。${loserName}被将杀，${winnerName}获胜！`;
            } else {
                message += `。${loserName}无棋可走（困毙），${winnerName}获胜！`;
            }
            return { success: true, message, gameOver: true, winner: this.winner };
        }

        if (this.isInCheck(opponent)) {
            message += '，将军！';
        }

        return { success: true, message };
    }

    // 将军检测
    isInCheck(color) {
        let kingRow = -1, kingCol = -1;
        const kingName = color === 'red' ? '帅' : '将';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.name === kingName && p.color === color) {
                    kingRow = r; kingCol = c; break;
                }
            }
            if (kingRow >= 0) break;
        }
        if (kingRow < 0) return true; // 将不存在=被吃=被将

        const opponent = color === 'red' ? 'black' : 'red';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === opponent) {
                    if (this.isValidMove(r, c, kingRow, kingCol, p)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // 获取某方所有合法走法（排除送将的走法）
    getAllMoves(color) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === color) {
                    for (let tr = 0; tr < 10; tr++) {
                        for (let tc = 0; tc < 9; tc++) {
                            if (this.isValidMove(r, c, tr, tc, p)) {
                                // 排除会造成己方被将军的走法
                                if (!this.wouldBeInCheck(r, c, tr, tc, color)) {
                                    moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc, piece: p });
                                }
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    // 棋子价值
    getPieceValue(piece) {
        if (!piece) return 0;
        const values = { king: 10000, rook: 900, cannon: 450, horse: 400, elephant: 120, advisor: 120, pawn: 30 };
        return values[piece.type] || 0;
    }

    // 位置加分
    getPositionBonus(piece, row, col) {
        let bonus = 0;
        if (piece.type === 'pawn') {
            if (piece.color === 'red' && row < 5) bonus += 20;
            if (piece.color === 'black' && row > 4) bonus += 20;
        }
        const centerColBonus = (4 - Math.abs(col - 4)) * 3;
        bonus += centerColBonus;
        if (piece.type === 'horse') {
            bonus += (4 - Math.abs(row - 4.5)) * 2;
        }
        return bonus;
    }

    // 局面评估
    evaluateBoard() {
        let score = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p) {
                    const val = this.getPieceValue(p) + this.getPositionBonus(p, r, c);
                    if (p.color === 'red') {
                        score += val;
                    } else {
                        score -= val;
                    }
                }
            }
        }
        return score;
    }

    // 模拟走棋（不修改状态）
    simulateMove(fromRow, fromCol, toRow, toCol) {
        const capturedId = this.board[toRow][toCol];
        const pieceId = this.board[fromRow][fromCol];
        this.board[toRow][toCol] = pieceId;
        this.board[fromRow][fromCol] = null;
        return { capturedId, pieceId };
    }

    // 撤销模拟
    undoSimulate(fromRow, fromCol, toRow, toCol, capturedId) {
        const pieceId = this.board[toRow][toCol];
        this.board[fromRow][fromCol] = pieceId;
        this.board[toRow][toCol] = capturedId;
    }

    // Minimax + Alpha-Beta 剪枝
    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return { score: this.evaluateBoard() };
        }

        const color = isMaximizing ? 'red' : 'black';
        const moves = this.getAllMoves(color);

        if (moves.length === 0) {
            return { score: isMaximizing ? -99999 : 99999 };
        }

        let bestMove = null;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const sim = this.simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const evalResult = this.minimax(depth - 1, alpha, beta, false);
                this.undoSimulate(move.fromRow, move.fromCol, move.toRow, move.toCol, sim.capturedId);

                if (evalResult.score > maxEval) {
                    maxEval = evalResult.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, evalResult.score);
                if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const sim = this.simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const evalResult = this.minimax(depth - 1, alpha, beta, true);
                this.undoSimulate(move.fromRow, move.fromCol, move.toRow, move.toCol, sim.capturedId);

                if (evalResult.score < minEval) {
                    minEval = evalResult.score;
                    bestMove = move;
                }
                beta = Math.min(beta, evalResult.score);
                if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }

    // 获取最佳走法
    getBestMove(color) {
        const depth = 3;
        const isMaximizing = color === 'red';
        const result = this.minimax(depth, -Infinity, Infinity, isMaximizing);
        return result.move || null;
    }

    // 获取当前方所有棋子
    getPiecesByColor(color) {
        const pieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === color) {
                    pieces.push({ row: r, col: c, piece: p });
                }
            }
        }
        return pieces;
    }

    // 获取棋盘上所有棋子（双方）
    getAllPieces() {
        const pieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p) {
                    pieces.push({ row: r, col: c, piece: p });
                }
            }
        }
        return pieces;
    }
}

// 导出
if (typeof module !== 'undefined') {
    module.exports = ChineseChess;
}
