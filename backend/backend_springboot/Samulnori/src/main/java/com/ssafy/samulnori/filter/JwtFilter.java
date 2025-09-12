package com.ssafy.samulnori.filter;

import com.ssafy.samulnori.model.dto.auth.AuthUserDTO;
import com.ssafy.samulnori.oauth2.LoginUserPrincipal;
import com.ssafy.samulnori.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String uri = request.getRequestURI();
        String method = request.getMethod();

        // ✅ 1) 프리플라이트는 인증 체크 없이 즉시 통과
        if ("OPTIONS".equalsIgnoreCase(method)) {
            // Nginx가 CORS 헤더를 붙여주지만, 로컬/직접접속 대비 204로 응답만 빠르게
            response.setStatus(HttpServletResponse.SC_NO_CONTENT); // 204
            return;
            // 또는 단순 통과만 원하면:
            // filterChain.doFilter(request, response);
            // return;
        }

        // 인증 필요 없는 경로 직접 분기
        if (
                uri.startsWith("/auth/signup") ||
                        uri.startsWith("/auth/login") ||
                        uri.startsWith("/auth/refresh") ||
                        uri.startsWith("/auth/logout") ||
                        uri.startsWith("/api/files") ||
                        ((uri.startsWith("/videos") && method.equals("GET") && !uri.equals("/videos/my") && !uri.equals("/videos/following"))) ||  // ✅ 괄호 추가됨
                        (uri.startsWith("/videos/search") && method.equals("GET")) ||
                        (uri.startsWith("/users/search")) ||
                        (uri.startsWith("/users/") && uri.endsWith("/profile")) ||
                        (uri.startsWith("/follow/followers")) ||
                        (uri.startsWith("follow/followings")) ||
                        (uri.matches("^/videos/\\d+/comments(/\\d+/replies)?$") && method.equals("GET"))
        ){
            filterChain.doFilter(request, response);
            return;
        }

        String token = extractTokenFromCookies(request);

        if (token == null || jwtUtil.isExpired(token)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); // 401
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Access token is missing or expired.\"}");
            return;
        }

        String loginName = jwtUtil.getLoginName(token);
        String role = jwtUtil.getRole(token);
        String id = jwtUtil.getId(token);

        // DTO 생성 및 인증 객체 구성
        AuthUserDTO authUserDTO = new AuthUserDTO();
        authUserDTO.setUserId(id);
        authUserDTO.setLoginName(loginName);
        authUserDTO.setRole(role);

        LoginUserPrincipal userDetails = new LoginUserPrincipal(authUserDTO);
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities()
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    // ✅ 쿠키에서 Authorization 추출 (널 체크 포함)
    private String extractTokenFromCookies(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;

        for (Cookie cookie : cookies) {
            if ("AccessToken".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}